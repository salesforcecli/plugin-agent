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
import { Org } from '@salesforce/core';
import type { AgentPreviewStartResult } from '../../src/commands/agent/preview/start.js';
import type { AgentPreviewSendResult } from '../../src/commands/agent/preview/send.js';
import type { AgentPreviewEndResult } from '../../src/commands/agent/preview/end.js';
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

  describe('using preview start/send/end commands', () => {
    it('should start, send, end a preview (Agent Script, mock mode)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const bundleApiName = 'Willie_Resort_Manager';
      const targetOrg = getUsername();

      const startResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(startResult?.sessionId).to.be.a('string');
      const sessionId = startResult!.sessionId;

      const sendResult1 = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "What can you help me with?" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult1?.messages).to.be.an('array').with.length.greaterThan(0);

      const sendResult2 = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "Tell me more" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult2?.messages).to.be.an('array').with.length.greaterThan(0);

      const endResult = execCmd<AgentPreviewEndResult>(
        `agent preview end --session-id ${sessionId} --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(endResult?.sessionId).to.equal(sessionId);
      expect(endResult?.tracesPath).to.be.a('string').and.include('.sfdx').and.include('agents');
    });

    it('should start, send, end a preview (Agent Script, live mode)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test
      const targetOrg = getUsername();
      // live tests require a valid 'default_agent_user' defined in the org, this is done for the publish tests, use that same agent, but from authoring-bundle source
      const org = await Org.create({ aliasOrUsername: targetOrg });
      const connection = org.getConnection();
      const publishedAgents = await Agent.listRemote(connection);
      const publishedAgent = publishedAgents.find((a) => a.DeveloperName?.startsWith('Test_Agent_'));
      expect(publishedAgent).to.not.be.undefined;
      expect(publishedAgent?.DeveloperName).to.be.a('string');

      const startResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --authoring-bundle ${publishedAgent?.DeveloperName} --use-live-actions --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(startResult?.sessionId).to.be.a('string');
      const sessionId = startResult!.sessionId;

      const sendResult1 = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --authoring-bundle ${publishedAgent?.DeveloperName} --utterance "What can you help me with?" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult1?.messages).to.be.an('array').with.length.greaterThan(0);

      execCmd<AgentPreviewEndResult>(
        `agent preview end --session-id ${sessionId} --authoring-bundle ${publishedAgent?.DeveloperName} --target-org ${targetOrg} --json`
      );
    });

    it('should start, send, end a preview (Published agent)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const org = await Org.create({ aliasOrUsername: getUsername() });
      const connection = org.getConnection();

      const publishedAgents = await Agent.listRemote(connection);
      const publishedAgent = publishedAgents.find((a) => a.DeveloperName?.startsWith('Test_Agent_'));
      expect(publishedAgent).to.not.be.undefined;
      expect(publishedAgent?.DeveloperName).to.be.a('string');

      // Activate published agent before previewing
      execCmd(`agent activate --api-name ${publishedAgent!.DeveloperName} --target-org ${getUsername()} --json`, {
        ensureExitCode: 0,
        cwd: session.project.dir,
      });

      const targetOrg = getUsername();

      const startResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --api-name ${publishedAgent!.DeveloperName} --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(startResult?.sessionId).to.be.a('string');
      const sessionId = startResult!.sessionId;

      const sendResult = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --api-name ${
          publishedAgent!.DeveloperName
        } --utterance "What can you help me with?" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult?.messages).to.be.an('array').with.length.greaterThan(0);

      const endResult = execCmd<AgentPreviewEndResult>(
        `agent preview end --session-id ${sessionId} --api-name ${
          publishedAgent!.DeveloperName
        } --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(endResult?.sessionId).to.equal(sessionId);
      expect(endResult?.tracesPath).to.be.a('string');
    });
  });
});
