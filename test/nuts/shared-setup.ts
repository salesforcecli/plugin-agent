/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { join } from 'node:path';
import { Duration, TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { ComponentSetBuilder, RequestStatus, type ScopedPostDeploy } from '@salesforce/source-deploy-retrieve';
import { Org, SfError, User, Lifecycle, Connection } from '@salesforce/core';
import { sleep, ensureArray } from '@salesforce/kit';

/* eslint-disable no-console */

// The shared TestSession + one scratch org used by the bulk of the suite.
let testSession: TestSession | undefined;
let testSessionPromise: Promise<TestSession> | undefined;
let agentUsername: string | undefined;
// Non-sensitive scratch-org identifiers captured at setup for CI failure correlation.
let orgId: string | undefined;
let orgPod: string | undefined;

// A DEDICATED SECOND scratch org (alias `runeval`) in the SAME TestSession for the
// `agent test run-eval` NUTs. PER-ORG ISOLATION EXPERIMENT: run-eval's first OAuth token grant
// trips `login rate exceeded` because the shared org's (or the CI runner IP's) login-rate budget
// is already spent by the rest of the suite before run-eval runs. A dedicated USER in the SAME
// org did not help (the cap is not per-user). Giving run-eval its OWN scratch org tests whether
// the cap is per-ORG (a fresh org has its own budget → run-eval succeeds) or per-IP (all orgs
// share the runner IP → still fails).
//
// NOTE: this must be a second ORG in the one TestSession, NOT a second TestSession — testkit wraps
// process.cwd() globally and a second TestSession.create() throws "Attempted to wrap cwd which is
// already wrapped" and corrupts the first session.
const RUN_EVAL_ORG_ALIAS = 'runeval';
let runEvalUsername: string | undefined;
let runEvalProvisionPromise: Promise<void> | undefined;

// The deploy progress listeners attach to the global Lifecycle singleton, so register them
// exactly once even though two orgs get provisioned.
let deployListenersRegistered = false;

// Format a UTC timestamp as MM/DD/YYYY:HH:mm:ss for CI log correlation (Splunk-friendly).
function fmtUtc(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()}:${p(d.getUTCHours())}:${p(
    d.getUTCMinutes()
  )}:${p(d.getUTCSeconds())}`;
}

// Helper function to wait for Einstein AI services to be ready
async function waitForEinsteinReady(connection: Connection, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Check Agent API status using direct HTTP call
      // eslint-disable-next-line no-await-in-loop
      const statusResponse = await connection.request<{ status: 'UP' | 'DOWN' }>({
        method: 'GET',
        url: 'https://api.salesforce.com/einstein/ai-agent/v1/status',
        headers: {
          'x-salesforce-region': 'us-west-2',
        },
      });

      if (statusResponse.status === 'UP') {
        return;
      }
    } catch {
      // do nothing
    }
    // Wait 10 seconds between checks
    await sleep(10 * 1000); // eslint-disable-line no-await-in-loop
  }
  const timeoutSeconds = maxAttempts * 10;
  throw new Error(`Einstein AI did not become ready within ${timeoutSeconds} seconds timeout`);
}

// Register the deploy progress logging once against the global Lifecycle singleton. The
// listeners reset their own progress counters on each `scopedPreDeploy`, so a single
// registration correctly handles the deploys of both the shared and the run-eval sessions.
function registerDeployListeners(): void {
  if (deployListenersRegistered) {
    return;
  }
  deployListenersRegistered = true;

  const lifecycle = Lifecycle.getInstance();
  let lastDeployed = 0;
  let lastTotal = 0;

  lifecycle.on('scopedPreDeploy', () => {
    console.log('[DEPLOY] Starting deployment...');
    // Reset progress tracking for new deployment
    lastDeployed = 0;
    lastTotal = 0;
    return Promise.resolve();
  });

  lifecycle.on('scopedPostDeploy', (result: ScopedPostDeploy) => {
    const deployResult = result.deployResult.response;
    const status = deployResult.status;
    const numberComponentErrors = deployResult.numberComponentErrors ?? 0;
    const numberComponentsDeployed = deployResult.numberComponentsDeployed ?? 0;
    const numberComponentsTotal = deployResult.numberComponentsTotal ?? 0;
    const numberTestErrors = deployResult.numberTestErrors ?? 0;
    const numberTestsCompleted = deployResult.numberTestsCompleted ?? 0;
    const numberTestsTotal = deployResult.numberTestsTotal ?? 0;

    // Log progress during polling (only if changed)
    if (
      (numberComponentsDeployed !== lastDeployed || numberComponentsTotal !== lastTotal) &&
      numberComponentsTotal > 0
    ) {
      console.log(
        `[DEPLOY] Progress: ${numberComponentsDeployed}/${numberComponentsTotal} components deployed${
          numberComponentErrors > 0 ? `, ${numberComponentErrors} errors` : ''
        }`
      );
      lastDeployed = numberComponentsDeployed;
      lastTotal = numberComponentsTotal;
    }

    // Log final status when deployment is complete
    const isComplete =
      status === RequestStatus.Succeeded || status === RequestStatus.Failed || status === RequestStatus.Canceled;
    if (isComplete) {
      console.log(`[DEPLOY] Deployment completed - Status: ${status}`);
      console.log(
        `[DEPLOY] Components: ${numberComponentsDeployed}/${numberComponentsTotal} deployed, ${numberComponentErrors} errors`
      );
      if (numberTestsTotal > 0) {
        console.log(
          `[DEPLOY] Tests: ${numberTestsCompleted}/${numberTestsTotal} completed, ${numberTestErrors} errors`
        );
      }
      const componentFailures = ensureArray(deployResult.details?.componentFailures);
      if (componentFailures.length > 0) {
        console.log(`[DEPLOY] Component failures: ${componentFailures.length}`);
        componentFailures.slice(0, 5).forEach((failure, idx) => {
          console.log(
            `[DEPLOY]   Failure ${idx + 1}: ${failure.fullName ?? 'unknown'} - ${failure.problemType ?? 'unknown'}: ${
              failure.problem ?? 'unknown'
            }`
          );
        });
      }
    }
    return Promise.resolve();
  });
}

/**
 * Provision a freshly-created scratch org so it can run agent evaluations: assign the Einstein
 * perm set to the admin, create the agent runtime user, wait for Einstein AI to come up, and
 * deploy the agent metadata (first without, then with the AiEvaluationDefinition). Used for BOTH
 * the shared session and the dedicated run-eval session.
 *
 * Side effect: sets `process.env.AGENT_USER_USERNAME` to THIS org's agent user, because the
 * metadata deploys use it as an SDR `replaceWithEnv` token (see mock project sfdx-project.json).
 * Any caller that provisions a second org must restore the env var afterward if a later deploy
 * targets a different org.
 */
async function provisionEvalOrg(
  session: TestSession,
  alias = 'default'
): Promise<{ username: string; agentUser: string; orgId: string; pod: string }> {
  const scratchOrg = session.orgs.get(alias);
  if (!scratchOrg?.username) {
    throw new Error(`No '${alias}' scratch org found in the test session.`);
  }
  const username = scratchOrg.username;
  console.log(`Using scratch org (${alias}): ${username}`);

  const org = await Org.create({ aliasOrUsername: username });
  const connection = org.getConnection();

  // Capture non-sensitive org identifiers for CI failure correlation (orgId + pod + UTC timestamp).
  const resolvedOrgId = org.getOrgId();
  const orgInfo = await connection.singleRecordQuery<{ InstanceName: string }>('SELECT InstanceName FROM Organization');
  const pod = orgInfo.InstanceName;
  console.log(`[NUT-CONTEXT] utc=${fmtUtc(new Date())} orgId=${resolvedOrgId} pod=${pod}`);

  // assign the EinsteinGPTPromptTemplateManager to the scratch org admin user
  const queryResult = await connection.singleRecordQuery<{ Id: string; Name: string }>(
    `SELECT Id, Name FROM User WHERE Username='${username}'`
  );
  const user = await User.create({ org });
  await user.assignPermissionSets(queryResult.Id, ['EinsteinGPTPromptTemplateManager']);
  console.log(`Permission set assigned to scratch org user: ${queryResult.Name}`);

  // Create agent user using the new CLI command
  console.log('Creating agent user...');
  const agentUserResult = execCmd<{ username: string }>(`org create agent-user --target-org ${username} --json`, {
    ensureExitCode: 0,
    cli: 'sf',
  });
  const agentUser = agentUserResult.jsonOutput?.result?.username;
  if (!agentUser) {
    throw new Error('Failed to create agent user: no username returned');
  }
  console.log(`Agent user created: ${agentUser}`);

  // Wait for Einstein AI services to be ready
  console.log('Waiting for Einstein AI services to be ready...');
  await waitForEinsteinReady(connection);
  console.log('Einstein AI services are ready');

  // Set environment variable for string replacement (SDR `replaceWithEnv`) used by the deploys.
  process.env.AGENT_USER_USERNAME = agentUser;
  process.env.SF_AAB_COMPILATION = 'false';

  registerDeployListeners();

  console.log('deploying metadata (no AiEvaluationDefinition)');
  const cs1 = await ComponentSetBuilder.build({
    manifest: {
      manifestPath: join(session.project.dir, 'noTest.xml'),
      directoryPaths: [session.homeDir],
    },
  });
  const deploy1 = await cs1.deploy({ usernameOrConnection: username });
  // pollStatus waits until deployment completes - will throw if deployment fails
  await deploy1.pollStatus({ frequency: Duration.seconds(10), timeout: Duration.minutes(30) });
  console.log('[DEPLOY] First deployment completed successfully');

  console.log('deploying metadata (AiEvaluationDefinition)');
  const cs2 = await ComponentSetBuilder.build({
    manifest: {
      manifestPath: join(session.project.dir, 'test.xml'),
      directoryPaths: [session.homeDir],
    },
  });
  const deploy2 = await cs2.deploy({ usernameOrConnection: username });
  // pollStatus waits until deployment completes - will throw if deployment fails
  await deploy2.pollStatus({ frequency: Duration.seconds(10), timeout: Duration.minutes(30) });
  console.log('[DEPLOY] Second deployment completed successfully');
  console.log('[DEPLOY] All deployments complete, tests can now run');

  return { username, agentUser, orgId: resolvedOrgId, pod };
}

/**
 * Gets the shared TestSession with a scratch org. This ensures only one TestSession
 * is created per test run, even if called from multiple test files simultaneously.
 * All callers will wait for the same creation promise.
 */
export async function getTestSession(): Promise<TestSession> {
  // If already created, return it immediately
  if (testSession) {
    return testSession;
  }

  // If creation is in progress, wait for the same promise
  if (testSessionPromise) {
    return testSessionPromise;
  }

  // Create the TestSession (only once, even if called from multiple test files simultaneously)
  // @ts-expect-error it can throw an error
  testSessionPromise = (async (): Promise<TestSession> => {
    try {
      console.log('Creating shared TestSession with scratch org...');
      const session = await TestSession.create({
        project: {
          sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
        },
        devhubAuthStrategy: 'AUTO',
        scratchOrgs: [
          {
            alias: 'default',
            setDefault: true,
            config: 'config/project-scratch-def.json',
          },
          {
            // Dedicated org for the run-eval NUTs (per-org login-rate isolation experiment).
            // Created here, provisioned lazily in getRunEvalTestSession().
            alias: RUN_EVAL_ORG_ALIAS,
            setDefault: false,
            config: 'config/project-scratch-def.json',
          },
        ],
      });

      testSession = session;
      console.log('TestSession created successfully');

      const provisioned = await provisionEvalOrg(session);
      agentUsername = provisioned.agentUser;
      orgId = provisioned.orgId;
      orgPod = provisioned.pod;

      return session;
    } catch (e) {
      console.log('XXXXXX ERROR XXXXXXX');
      console.dir(SfError.wrap(e).toObject());
      void Promise.reject(SfError.wrap(e));
    }
  })();

  return testSessionPromise;
}

/**
 * Gets the scratch org username from the shared test session.
 * Throws an error if the session hasn't been created yet.
 */
export function getUsername(): string {
  if (!testSession) {
    throw new Error('Test session not available. Call getTestSession() first.');
  }

  const orgs = testSession.orgs;
  if (!orgs || orgs.size === 0) {
    throw new Error('No orgs found in test session.');
  }

  return testSession.orgs.get('default')!.username!;
}

/**
 * Gets the agent user, username, from the shared test session.
 * Throws an error if the session hasn't been created yet.
 */
export function getAgentUsername(): string | undefined {
  if (!testSession) {
    throw new Error('Test session not available. Call getTestSession() first.');
  }
  return agentUsername;
}

/**
 * Ensures the DEDICATED run-eval scratch org (alias `runeval`, created alongside the shared org in
 * the one TestSession) is provisioned and ready. Provisioned lazily and exactly once. See the
 * per-org isolation experiment note above. After provisioning, restores
 * `process.env.AGENT_USER_USERNAME` to the shared org's agent user so later shared-org deploys
 * (e.g. z2 publish of Willie_Resort_Manager.agent) are not contaminated with this org's agent user.
 */
export async function getRunEvalTestSession(): Promise<TestSession> {
  // Ensure the shared session (which also created the `runeval` org) exists first.
  const session = await getTestSession();

  runEvalProvisionPromise ??= (async (): Promise<void> => {
    console.log('Provisioning DEDICATED run-eval scratch org...');
    const provisioned = await provisionEvalOrg(session, RUN_EVAL_ORG_ALIAS);
    runEvalUsername = provisioned.username;
    console.log(`[NUT-CONTEXT] run-eval dedicated org username=${provisioned.username} orgId=${provisioned.orgId}`);

    // Restore the SDR replacement env var to the shared org's agent user, so later shared-org
    // deploys are not contaminated by the run-eval org's agent user.
    if (agentUsername) {
      process.env.AGENT_USER_USERNAME = agentUsername;
    }
  })();
  await runEvalProvisionPromise;

  return session;
}

/**
 * Gets the username of the dedicated run-eval scratch org.
 * Throws an error if it hasn't been provisioned yet.
 */
export function getRunEvalUsername(): string {
  if (!runEvalUsername) {
    throw new Error('Run-eval org not provisioned. Call getRunEvalTestSession() first.');
  }
  return runEvalUsername;
}

// Root-level hook: on any failing test that used the shared scratch org, emit orgId + pod +
// UTC timestamp + error so CI logs can be correlated in Splunk. Registered once when this shared
// module is first imported by the z-series NUTs. (A failing before-all hook is not caught here, but
// the [NUT-CONTEXT] line logged at setup still records that run's orgId + pod + time.)
afterEach(function (this: Mocha.Context) {
  if (this.currentTest?.state === 'failed' && orgId) {
    const err = this.currentTest.err;
    console.log(
      `[NUT-FAILURE] utc=${fmtUtc(new Date())} orgId=${orgId} pod=${
        orgPod ?? 'unknown'
      } test="${this.currentTest.fullTitle()}" error=${err?.message ?? String(err)}`
    );
  }
});
