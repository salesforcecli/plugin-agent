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
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { Connection, Org } from '@salesforce/core';
import type { AgentPublishAuthoringBundleResult } from '../../src/commands/agent/publish/authoring-bundle.js';
import type { AgentGenerateAuthoringBundleResult } from '../../src/commands/agent/generate/authoring-bundle.js';
import { getAgentUsername, getTestSession, getUsername } from './shared-setup.js';

type BotDefinitionWithVersions = {
  Id: string;
  BotVersions: {
    records: Array<{ DeveloperName: string }>;
  };
};

const verifyPublishedAgent = async (
  botApiName: string,
  expectedVersion: string,
  connection: Connection
): Promise<void> => {
  let botDefinition;
  try {
    botDefinition = await connection.singleRecordQuery<BotDefinitionWithVersions>(
      `SELECT SELECT Id, (SELECT DeveloperName FROM BotVersions LIMIT 10) FROM BotDefinition WHERE DeveloperName = '${botApiName}' LIMIT 1`
    );
    const botVersion = botDefinition.BotVersions.records[0].DeveloperName;
    expect(botVersion).to.equal(expectedVersion);
  } catch (error) {
    // bot not found
    void Promise.reject(error);
  }
};

describe('agent publish authoring-bundle NUTs', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  let session: TestSession;
  let connection: Connection;
  const bundleApiName = genUniqueString('Test_Agent_%s');
  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    session = await getTestSession();
    const org = await Org.create({ aliasOrUsername: getUsername() });
    connection = org.getConnection();
  });

  it('should publish a new agent (first version)', async function () {
    // Increase timeout to 30 minutes since deployment can take a long time
    this.timeout(30 * 60 * 1000); // 30 minutes
    // Retry up to 3 times total (1 initial + 2 retries) to handle transient failures
    this.retries(2);
    const specFileName = genUniqueString('agentSpec_%s.yaml');
    const specPath = join(session.project.dir, 'specs', specFileName);

    // Step 1: Generate an agent spec
    const specCommand = `agent generate agent-spec --target-org ${getUsername()} --type customer --role "test agent role" --company-name "Test Company" --company-description "Test Description" --output-file ${specPath} --json`;
    execCmd(specCommand, { ensureExitCode: 0 });

    // Step 2: Generate the authoring bundle from the spec
    const generateCommand = `agent generate authoring-bundle --spec ${specPath} --name "${bundleApiName}" --api-name ${bundleApiName} --target-org ${getUsername()} --json`;
    const generateResult = execCmd<AgentGenerateAuthoringBundleResult>(generateCommand, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(generateResult).to.be.ok;

    // Step 2.5: Update default_agent_user in the generated .agent file to the 'agent user' we created in shared setup
    if (generateResult?.agentPath) {
      const agentContent = readFileSync(generateResult.agentPath, 'utf8');
      // Replace default_agent_user with the devhub username
      const updatedContent = agentContent.replace(
        /default_agent_user:\s*"[^"]*"/,
        `default_agent_user: "${getAgentUsername()!}"`
      );
      writeFileSync(generateResult.agentPath, updatedContent, 'utf8');
    }

    // Step 3: Publish the authoring bundle (first version)
    const publishResult = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${getUsername()} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(publishResult).to.be.ok;
    expect(publishResult?.success).to.be.true;
    expect(publishResult?.botDeveloperName).to.be.a('string');
    expect(publishResult?.errors).to.be.undefined;
    await verifyPublishedAgent(bundleApiName, 'v1', connection);
  });

  it('should publish a new version of an existing agent', async function () {
    // Increase timeout to 30 minutes since deployment can take a long time
    this.timeout(30 * 60 * 1000); // 30 minutes
    // Retry up to 2 times total (1 initial + 1 retries) to handle transient failures
    this.retries(1);
    // Publish the existing Willie_Resort_Manager authoring bundle
    const result = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${getUsername()} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.botDeveloperName).to.be.a('string');
    expect(result?.errors).to.be.undefined;
    await verifyPublishedAgent(bundleApiName, 'v2', connection);
  });

  it('should publish agent with skip-retrieve flag', async function () {
    // Test that the --skip-retrieve flag works correctly
    // This flag skips the metadata retrieval step in the publishing process
    // Increase timeout to 30 minutes since deployment can take a long time
    this.timeout(30 * 60 * 1000); // 30 minutes
    // Retry up to 2 times total (1 initial + 1 retries) to handle transient failures
    this.retries(1);

    const result = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${getUsername()} --skip-retrieve --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.botDeveloperName).to.be.a('string');
    expect(result?.errors).to.be.undefined;
  });

  it('should publish agent with skip-retrieve and custom api-version', async function () {
    // Increase timeout to 30 minutes since deployment can take a long time
    this.timeout(30 * 60 * 1000); // 30 minutes
    // Retry up to 2 times total (1 initial + 1 retries) to handle transient failures
    this.retries(1);

    const result = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${getUsername()} --skip-retrieve --api-version 59.0 --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.botDeveloperName).to.be.a('string');
    expect(result?.errors).to.be.undefined;
  });

  it('should fail for invalid bundle api-name', async () => {
    const invalidApiName = 'Invalid_Bundle_Name_That_Does_Not_Exist';

    execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${invalidApiName} --target-org ${getUsername()} --json`,
      { ensureExitCode: 2 }
    );
  });
});
