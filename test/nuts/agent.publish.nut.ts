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
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { Org } from '@salesforce/core';
import type { AgentPublishAuthoringBundleResult } from '../../src/commands/agent/publish/authoring-bundle.js';
import type { AgentGenerateAuthoringBundleResult } from '../../src/commands/agent/generate/authoring-bundle.js';
import { getDevhubUsername } from './shared-setup.js';

describe('agent publish authoring-bundle NUTs', () => {
  let session: TestSession;
  const bundleApiName = 'Willie_Resort_Manager';

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await session?.clean();
  });

  it.skip('should publish a new agent (first version)', async () => {
    const username = getDevhubUsername(session);

    // Generate a unique bundle name to ensure it's a new agent
    const bundleName = genUniqueString('Test_Agent_%s');
    const newBundleApiName = genUniqueString('Test_Agent_%s');
    const specFileName = genUniqueString('agentSpec_%s.yaml');
    const specPath = join(session.project.dir, 'specs', specFileName);

    // Step 1: Generate an agent spec
    const specCommand = `agent generate agent-spec --target-org ${username} --type customer --role "test agent role" --company-name "Test Company" --company-description "Test Description" --output-file ${specPath} --json`;
    execCmd(specCommand, { ensureExitCode: 0 });

    // Step 2: Generate the authoring bundle from the spec
    const generateCommand = `agent generate authoring-bundle --spec ${specPath} --name "${bundleName}" --api-name ${newBundleApiName} --target-org ${username} --json`;
    const generateResult = execCmd<AgentGenerateAuthoringBundleResult>(generateCommand, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(generateResult).to.be.ok;

    // Step 2.5: Update default_agent_user in the generated .agent file
    if (generateResult?.agentPath) {
      const agentContent = readFileSync(generateResult.agentPath, 'utf8');
      // Replace default_agent_user with the devhub username
      const updatedContent = agentContent.replace(
        /default_agent_user:\s*"[^"]*"/,
        'default_agent_user: "ge.agent@afdx-usa1000-02.testorg"'
      );
      writeFileSync(generateResult.agentPath, updatedContent, 'utf8');
    }

    // Step 3: Publish the authoring bundle (first version)
    const publishResult = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${newBundleApiName} --target-org ${username} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(publishResult).to.be.ok;
    expect(publishResult?.success).to.be.true;
    expect(publishResult?.botDeveloperName).to.be.a('string');
    expect(publishResult?.errors).to.be.undefined;

    // Cleanup: Delete the created metadata
    if (!publishResult?.botDeveloperName) {
      throw new Error('botDeveloperName not found in publish result');
    }

    const org = await Org.create({ aliasOrUsername: username });
    const connection = org.getConnection();
    const botDeveloperName = publishResult.botDeveloperName;

    // Query for Bot and BotVersions
    type BotDefinitionWithVersions = {
      Id: string;
      DeveloperName: string;
      BotVersions: {
        records: Array<{ Id: string }>;
      };
    };

    const botResult = await connection.singleRecordQuery<BotDefinitionWithVersions>(
      `SELECT Id, DeveloperName, (SELECT Id FROM BotVersions) FROM BotDefinition WHERE DeveloperName = '${botDeveloperName}' LIMIT 1`
    );

    // Delete BotVersions first (must delete before Bot)
    if (botResult.BotVersions?.records && botResult.BotVersions.records.length > 0) {
      const botVersionIds = botResult.BotVersions.records.map((bv) => bv.Id);
      // Delete all BotVersions in parallel
      await Promise.all(botVersionIds.map((id) => connection.sobject('BotVersion').destroy(id)));
    }

    // Delete Bot
    await connection.sobject('BotDefinition').destroy(botResult.Id);

    // Query and delete GenAiPlannerBundle
    type GenAiPlannerBundleResult = {
      Id: string;
      DeveloperName: string;
    };

    const plannerBundleResult = await connection.query<GenAiPlannerBundleResult>(
      `SELECT Id, DeveloperName FROM GenAiPlannerBundle WHERE DeveloperName = '${botDeveloperName}' LIMIT 1`
    );

    if (plannerBundleResult.records && plannerBundleResult.records.length > 0) {
      await connection.sobject('GenAiPlannerBundle').destroy(plannerBundleResult.records[0].Id);
    }

    // Query and delete AiAuthoringBundle metadata
    type AiAuthoringBundleResult = {
      Id: string;
      DeveloperName: string;
    };

    const authoringBundleResult = await connection.query<AiAuthoringBundleResult>(
      `SELECT Id, DeveloperName FROM AiAuthoringBundle WHERE DeveloperName = '${newBundleApiName}' LIMIT 1`
    );

    if (authoringBundleResult.records && authoringBundleResult.records.length > 0) {
      await connection.sobject('AiAuthoringBundle').destroy(authoringBundleResult.records[0].Id);
    }
  });

  it.skip('should publish a new version of an existing agent', async () => {
    const username = getDevhubUsername(session);

    // Publish the existing Willie_Resort_Manager authoring bundle
    const result = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${username} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.botDeveloperName).to.be.a('string');
    expect(result?.errors).to.be.undefined;
  });

  it('should fail for invalid bundle api-name', async () => {
    const username = getDevhubUsername(session);
    const invalidApiName = 'Invalid_Bundle_Name_That_Does_Not_Exist';

    execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${invalidApiName} --target-org ${username} --json`,
      { ensureExitCode: 1 }
    );
  });
});
