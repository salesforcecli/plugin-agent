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

import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { Agent } from '@salesforce/agents';
import { Org, SfProject } from '@salesforce/core';
import { getTestSession, getUsername } from './shared-setup.js';
/* eslint-disable no-console */

describe('agent preview', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  let session: TestSession;

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    session = await getTestSession();
  });

  it('should fail when authoring bundle does not exist', async () => {
    const invalidBundle = 'NonExistent_Bundle';
    execCmd(`agent preview --authoring-bundle ${invalidBundle} --target-org ${getUsername()}`, { ensureExitCode: 1 });
  });

  it('should fail when api-name does not exist in org', async () => {
    const invalidApiName = 'NonExistent_Agent_12345';
    execCmd(`agent preview --api-name ${invalidApiName} --target-org ${getUsername()}`, { ensureExitCode: 1 });
  });

  describe('using agent library directly', function () {
    it("should start,send,end a preview (AgentScript, preview API, mockMode = 'Mock'", async () => {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const bundleApiName = 'Willie_Resort_Manager';
      const projectPath = session.project.dir;

      const org = await Org.create({ aliasOrUsername: getUsername() });
      const connection = org.getConnection();
      const project = await SfProject.resolve(projectPath);

      const agent = await Agent.init({
        connection,
        project,
        aabName: bundleApiName,
      });

      agent.preview.setMockMode('Mock');

      // Start session
      const previewSession = await agent.preview.start();
      expect(previewSession.sessionId).to.be.a('string');

      // Send first message
      const response1 = await agent.preview.send('What can you help me with?');
      expect(response1.messages).to.be.an('array').with.length.greaterThan(0);

      // Send second message
      const response2 = await agent.preview.send('Tell me more');
      expect(response2.messages).to.be.an('array').with.length.greaterThan(0);

      // End session
      await agent.preview.end();
    });
    it("should start,send,end a preview (AgentScript, preview API, mockMode = 'Live Test'", async () => {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const bundleApiName = 'Willie_Resort_Manager';
      const projectPath = session.project.dir;

      const org = await Org.create({ aliasOrUsername: getUsername() });
      const connection = org.getConnection();
      const project = await SfProject.resolve(projectPath);

      const agent = await Agent.init({
        connection,
        project,
        aabName: bundleApiName,
      });

      // Start session
      const previewSession = await agent.preview.start();
      expect(previewSession.sessionId).to.be.a('string');

      // Send first message
      const response1 = await agent.preview.send('What can you help me with?');
      expect(response1.messages).to.be.an('array').with.length.greaterThan(0);

      // Send second message
      const response2 = await agent.preview.send('Tell me more');
      expect(response2.messages).to.be.an('array').with.length.greaterThan(0);

      // End session
      await agent.preview.end();
    });

    it('should start,send,end a preview (Published) session', async () => {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const org = await Org.create({ aliasOrUsername: getUsername() });
      const connection = org.getConnection();
      const project = await SfProject.resolve(session.project.dir);

      // Find the published agent from the publish test (starts with "Test_Agent_")
      const publishedAgents = await Agent.listRemote(connection);
      const publishedAgent = publishedAgents.find((agent) => agent.DeveloperName?.startsWith('Test_Agent_'));

      expect(publishedAgent).to.not.be.undefined;
      expect(publishedAgent?.DeveloperName).to.be.a('string');

      // Query the Bot object to get the Id
      const botResult = await connection.singleRecordQuery<{ Id: string }>(
        `SELECT ID FROM BotDefinition WHERE DeveloperName = '${publishedAgent!.DeveloperName}'`
      );

      expect(botResult).to.not.be.undefined;
      expect(botResult.Id).to.be.a('string').and.not.be.empty;

      // Initialize the published agent using its Bot Id
      const agent = await Agent.init({
        connection,
        project,
        apiNameOrId: botResult.Id,
      });

      // gotta activate published agents before previewing
      await agent.activate();

      // Start session
      const previewSession = await agent.preview.start();
      expect(previewSession.sessionId).to.be.a('string');

      const response = await agent.preview.send('What can you help me with?');
      expect(response.messages).to.be.an('array').with.length.greaterThan(0);
    });
  });
});
