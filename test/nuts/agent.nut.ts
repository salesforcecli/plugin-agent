/*
 * Copyright 2025, Salesforce, Inc.
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
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { Connection, Org, User, UserFields } from '@salesforce/core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { sleep } from '@salesforce/kit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { AgentTestCache } from '../../src/agentTestCache.js';
import type { AgentTestListResult } from '../../src/commands/agent/test/list.js';
import type { AgentTestResultsResult } from '../../src/commands/agent/test/results.js';
import type { AgentTestRunResult } from '../../src/flags.js';
import type { AgentCreateSpecResult } from '../../src/commands/agent/generate/agent-spec.js';
import type { AgentCreateResult } from '../../src/commands/agent/create.js';

/* eslint-disable no-console */

/**
 * Returns it.skip if the current date is before the specified date, otherwise returns it.
 * Used to conditionally enable tests after a specific date.
 */
const itAfter = (date: Date) => (new Date() >= date ? it : it.skip);

let session: TestSession;

describe('plugin-agent NUTs', () => {
  let connection: Connection;
  let defaultOrg: Org;
  let username: string;
  const botApiName = 'Local_Info_Agent';

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          setDefault: true,
          config: join('config', 'project-scratch-def.json'),
        },
      ],
    });
    username = session.orgs.get('default')!.username as string;
    defaultOrg = await Org.create({ aliasOrUsername: username });
    connection = defaultOrg.getConnection();

    // assign the EinsteinGPTPromptTemplateManager to the scratch org admin user
    const queryResult = await connection.singleRecordQuery<{ Id: string }>(
      `SELECT Id FROM User WHERE Username='${username}'`
    );
    const user = await User.create({ org: defaultOrg });
    await user.assignPermissionSets(queryResult.Id, ['EinsteinGPTPromptTemplateManager']);

    // create a bot user
    await createBotUser(connection, defaultOrg, botApiName);

    // deploy metadata
    await deployMetadata(connection);

    // wait for the agent to be provisioned
    console.log('\nWaiting 4 minutes for agent provisioning...\n');
    await sleep(240_000);
  });

  after(async () => {
    await session?.clean();
  });

  describe('agent test', () => {
    const agentTestName = 'Local_Info_Agent_Test';

    describe('agent test list', () => {
      it('should list agent tests in org', async () => {
        const result = execCmd<AgentTestListResult>(`agent test list --target-org ${username} --json`, {
          ensureExitCode: 0,
        }).jsonOutput?.result;
        expect(result).to.be.ok;
        expect(result?.length).to.be.greaterThanOrEqual(1);
        expect(result?.at(0)?.type).to.include('AiEvaluationDefinition');
      });
    });

    describe('agent test run', () => {
      it('should start async test run', async () => {
        const command = `agent test run --api-name ${agentTestName} --target-org ${username} --json`;
        const output = execCmd<AgentTestRunResult>(command, {
          ensureExitCode: 0,
        }).jsonOutput;
        expect(output?.result.status).to.equal('NEW');
        expect(output?.result.runId.startsWith('4KB')).to.be.true;

        // check cache for test run entry
        const cache = await AgentTestCache.create();
        const testRun = cache.resolveFromCache();
        expect(testRun.runId.startsWith('4KB')).to.be.true;
        expect(testRun.name).to.equal(agentTestName);
      });

      it('should poll for test run completion when --wait is used', async () => {
        const command = `agent test run --api-name ${agentTestName} --target-org ${username} --wait 5 --json`;
        const output = execCmd<AgentTestRunResult>(command, {
          ensureExitCode: 0,
        }).jsonOutput;

        expect(output?.result.status).to.equal('COMPLETED');
        expect(output?.result.runId.startsWith('4KB')).to.be.true;
      });
    });

    describe('agent test results', () => {
      it('should get results of completed test run', async () => {
        // Ensure cache is cleared before running the test
        const cache = await AgentTestCache.create();
        cache.clear();

        const runResult = execCmd<AgentTestRunResult>(
          `agent test run --api-name ${agentTestName} --target-org ${username} --wait 5 --json`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput;

        expect(runResult?.result.runId).to.be.ok;
        expect(runResult?.result.status.toLowerCase()).to.equal('completed');

        const output = execCmd<AgentTestResultsResult>(
          `agent test results --job-id ${runResult?.result.runId} --target-org ${username} --json`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput;

        expect(output?.result.status.toLowerCase()).to.equal('completed');
        expect(output?.result.testCases.length).to.equal(2);

        // check that cache does not have an entry
        expect(() => cache.resolveFromCache()).to.throw('Could not find a runId to resume');
      });
    });

    describe('agent test resume', () => {
      it('should resume async test run', async () => {
        // Ensure cache is cleared before running the test
        const cache = await AgentTestCache.create();
        cache.clear();

        const runResult = execCmd<AgentTestRunResult>(
          `agent test run --api-name ${agentTestName} --target-org ${username} --json`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput;

        expect(runResult?.result.runId).to.be.ok;

        const output = execCmd<AgentTestRunResult>(
          `agent test resume --job-id ${runResult?.result.runId} --target-org ${username} --json`,
          {
            ensureExitCode: 0,
          }
        ).jsonOutput;

        expect(output?.result.status).to.equal('COMPLETED');
        expect(output?.result.runId.startsWith('4KB')).to.be.true;

        // check that cache does not have an entry
        expect(() => cache.resolveFromCache()).to.throw('Could not find a runId to resume');
      });
    });
  });

  describe('agent activate/deactivate', () => {
    const botStatusQuery = `SELECT Status FROM BotVersion WHERE BotDefinitionId IN (SELECT Id FROM BotDefinition WHERE DeveloperName = '${botApiName}') LIMIT 1`;

    it('should activate the agent', async () => {
      // Verify the BotVersion status has 'Inactive' initial state
      const botVersionInitalState = await connection.singleRecordQuery<{ Status: string }>(botStatusQuery);
      expect(botVersionInitalState.Status).to.equal('Inactive');

      try {
        execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --json`, { ensureExitCode: 0 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'unknown';
        const waitMin = 3;
        console.log(`Error activating agent due to ${errMsg}. \nWaiting ${waitMin} minutes and trying again...`);
        await sleep(waitMin * 60 * 1000);
        console.log(`${waitMin} minutes is up, retrying now.`);
        execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --json`, { ensureExitCode: 0 });
      }

      // Verify the BotVersion status is now 'Active'
      const botVersionResult = await connection.singleRecordQuery<{ Status: string }>(botStatusQuery);
      expect(botVersionResult.Status).to.equal('Active');
    });

    it('should deactivate the agent', async () => {
      // Verify the BotVersion status has 'Active' initial state
      const botVersionInitalState = await connection.singleRecordQuery<{ Status: string }>(botStatusQuery);
      expect(botVersionInitalState.Status).to.equal('Active');

      execCmd(`agent deactivate --api-name ${botApiName} --target-org ${username} --json`, { ensureExitCode: 0 });

      // Verify the BotVersion status is now 'Inactive'
      const botVersionResult = await connection.singleRecordQuery<{ Status: string }>(botStatusQuery);
      expect(botVersionResult.Status).to.equal('Inactive');
    });
  });

  describe('agent create', () => {
    const specFileName = genUniqueString('agentSpec_%s.yaml');

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

      let output;
      try {
        output = execCmd<AgentCreateSpecResult>(command, { ensureExitCode: 0 }).jsonOutput;
      } catch (err) {
        console.log('error generating agent spec. Waiting 2 minutes and trying again.');
        // If the agent spec fails during creation, wait 2 minutes and try again.
        await sleep(120_000);
        output = execCmd<AgentCreateSpecResult>(command, { ensureExitCode: 0 }).jsonOutput;
      }

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

    // skip until 12/16 - should be fixed in server-side release then
    itAfter(new Date('2025-12-16'))('should create new agent in org', async () => {
      const expectedFilePath = join(session.project.dir, 'specs', specFileName);
      const name = 'Plugin Agent Test';
      const apiName = 'Plugin_Agent_Test';
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
      expect(readdirSync(join(sourceDir, 'bots'))).to.have.length.greaterThan(3);
      expect(readdirSync(join(sourceDir, 'genAiPlannerBundles'))).to.have.length.greaterThan(3);
      expect(readdirSync(join(sourceDir, 'genAiPlugins'))).to.have.length.greaterThan(3);
    });
  });
});

const createBotUser = async (connection: Connection, defaultOrg: Org, botApiName: string) => {
  // Query for the agent user profile
  const queryResult = await connection.singleRecordQuery<{ Id: string }>(
    "SELECT Id FROM Profile WHERE Name='Einstein Agent User'"
  );
  const profileId = queryResult.Id;

  // create a new unique bot user
  const botUsername = genUniqueString('botUser_%s@test.org');
  const botUser = await User.create({ org: defaultOrg });
  // @ts-expect-error - private method. Must use this to prevent the auth flow that happens with the createUser method
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const { userId } = (await botUser.createUserInternal({
    username: botUsername,
    lastName: 'AgentUser',
    alias: 'botUser',
    timeZoneSidKey: 'America/Denver',
    email: botUsername,
    emailEncodingKey: 'UTF-8',
    languageLocaleKey: 'en_US',
    localeSidKey: 'en_US',
    profileId,
  } as UserFields)) as { userId: string };

  await botUser.assignPermissionSets(userId, ['AgentforceServiceAgentUser']);

  // Replace the botUser with the current user's username
  const botDir = join(session.project.dir, 'force-app', 'main', 'default', 'bots', botApiName);
  const botFile = readFileSync(join(botDir, 'Local_Info_Agent.bot-meta.xml'), 'utf8');
  const updatedBotFile = botFile.replace('%BOT_USER%', botUsername);
  writeFileSync(join(botDir, 'Local_Info_Agent.bot-meta.xml'), updatedBotFile);
};

const deployMetadata = async (connection: Connection) => {
  // deploy Local_Info_Agent to scratch org
  const compSet1 = await ComponentSetBuilder.build({
    metadata: {
      metadataEntries: ['Agent:Local_Info_Agent'],
      directoryPaths: [join(session.project.dir, 'force-app', 'main', 'default')],
    },
  });
  const deploy1 = await compSet1.deploy({ usernameOrConnection: connection });
  const deployResult1 = await deploy1.pollStatus();
  if (!deployResult1.response.success) {
    console.dir(deployResult1.response, { depth: 10 });
  }
  expect(deployResult1.response.success, 'expected Agent deploy to succeed').to.equal(true);

  // deploy Local_Info_Agent_Test to scratch org
  const compSet2 = await ComponentSetBuilder.build({
    metadata: {
      metadataEntries: ['AiEvaluationDefinition:Local_Info_Agent_Test'],
      directoryPaths: [join(session.project.dir, 'force-app', 'main', 'default')],
    },
  });
  const deploy2 = await compSet2.deploy({ usernameOrConnection: connection });
  const deployResult2 = await deploy2.pollStatus();
  if (!deployResult2.response.success) {
    console.dir(deployResult2.response, { depth: 10 });
  }
  expect(deployResult2.response.success, 'expected Agent Test deploy to succeed').to.equal(true);
};
