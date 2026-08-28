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
import { appendFileSync, readdirSync, statSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentCreateSpecResult } from '../../src/commands/agent/generate/agent-spec.js';
import type { AgentCreateResult } from '../../src/commands/agent/create.js';
import { getAgentUsername, getTestSession, getUsername } from './shared-setup.js';

/* eslint-disable no-console */

describe('agent create', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  let session: TestSession;
  let username: string;
  const specFileName = genUniqueString('agentSpec_%s.yaml');

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    session = await getTestSession();
    username = getUsername();
  });

  it('should generate spec file with minimal flags', async () => {
    const expectedFilePath = join(session.project.dir, 'specs', specFileName);
    const targetOrg = `--target-org ${username}`;
    const type = 'customer';
    const role = 'test agent role';
    const companyName = 'Test Company Name';
    const companyDescription = 'Test Company Description';
    const companyWebsite = 'https://test-company-website.org';
    const outputSpecFile = `${expectedFilePath}`;
    const command = `agent generate agent-spec ${targetOrg} --type ${type} --role "${role}" --company-name "${companyName}" --company-description "${companyDescription}" --company-website ${companyWebsite} --output-file ${outputSpecFile} --json`;

    const output = execCmd<AgentCreateSpecResult>(command, { ensureExitCode: 0 }).jsonOutput;

    expect(output?.result.isSuccess).to.be.true;
    expect(output?.result.specPath).to.equal(expectedFilePath);
    expect(output?.result.agentType).to.equal(type);
    expect(output?.result.role).to.equal(role);
    expect(output?.result.companyName).to.equal(companyName);
    expect(output?.result.companyDescription).to.equal(companyDescription);
    expect(output?.result.topics).to.be.an('array').with.lengthOf(5);
    const fileStat = statSync(expectedFilePath);
    expect(fileStat.isFile()).to.be.true;
    expect(fileStat.size).to.be.greaterThan(0);
  });

  it('should create new agent in org', async () => {
    const expectedFilePath = join(session.project.dir, 'specs', specFileName);
    const name = 'Plugin Agent Test';
    const apiName = 'Plugin_Agent_Test';

    // Reuse the Bot User pre-provisioned in shared setup (via `org create agent-user`) instead of
    // letting core auto-create one during the save. The 'customer' agentType maps to core's
    // EinsteinServiceAgent, which requires a licensed Bot User; when no user is supplied, core creates
    // that user in the SAME transaction as the BotDefinition save, and the pre-save validation trigger
    // intermittently cannot see the just-created license/permset assignment, failing with "User
    // doesn't have access to agent." `agent create` sets agentSettings.userId from the spec's
    // `agentUser`, so writing the already-committed agent user into the spec removes that race.
    const agentUser = getAgentUsername();
    expect(agentUser, 'agent user should have been provisioned in shared setup').to.be.a('string');
    appendFileSync(expectedFilePath, `\nagentUser: "${agentUser!}"\n`);

    const command = `agent create --spec ${expectedFilePath} --target-org ${username} --name "${name}" --api-name ${apiName} --json`;
    const result = execCmd<AgentCreateResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;
    expect(result).to.be.ok;
    if (!result?.isSuccess) {
      console.dir(result, { depth: 10 });
    }
    expect(result?.isSuccess).to.equal(true);
    expect(result?.agentId?.botId).to.be.ok;
    expect(result?.agentDefinition.sampleUtterances.length).to.be.greaterThanOrEqual(1);

    // verify agent metadata files are retrieved to the project
    const sourceDir = join(session.project.dir, 'force-app', 'main', 'default');
    expect(readdirSync(join(sourceDir, 'bots')).length).to.greaterThanOrEqual(3);
    expect(readdirSync(join(sourceDir, 'genAiPlannerBundles')).length).to.greaterThanOrEqual(3);
    expect(readdirSync(join(sourceDir, 'genAiPlugins')).length).to.greaterThanOrEqual(3);
  });
});
