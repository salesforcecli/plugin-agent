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
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { Agent } from '@salesforce/agents';
import { Org } from '@salesforce/core';
import type { AgentPreviewResult } from '../../src/commands/agent/preview.js';
import { getTestSession, getUsername } from './shared-setup.js';
/* eslint-disable no-console */

describe('agent preview', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    await getTestSession();
  });

  it('should fail when authoring bundle does not exist', async () => {
    const invalidBundle = 'NonExistent_Bundle';
    execCmd(`agent preview --authoring-bundle ${invalidBundle} --target-org ${getUsername()}`, { ensureExitCode: 1 });
  });

  it('should fail when api-name does not exist in org', async () => {
    const invalidApiName = 'NonExistent_Agent_12345';
    execCmd(`agent preview --api-name ${invalidApiName} --target-org ${getUsername()}`, { ensureExitCode: 1 });
  });

  describe('using preview command with --utterance', () => {
    it("should send utterance and return response (AgentScript, mockMode = 'Mock')", async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const bundleApiName = 'Willie_Resort_Manager';
      const result = execCmd<AgentPreviewResult>(
        `agent preview --authoring-bundle ${bundleApiName} --utterance "What can you help me with?" --target-org ${getUsername()} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      expect(result).to.not.be.undefined;
      expect(result?.sessionId).to.be.a('string').and.not.be.empty;
      expect(result?.response).to.be.a('string').and.not.be.empty;
    });

    it("should send utterance and return response (AgentScript, mockMode = 'Live Test')", async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const bundleApiName = 'Willie_Resort_Manager';
      const result = execCmd<AgentPreviewResult>(
        `agent preview --authoring-bundle ${bundleApiName} --use-live-actions --utterance "What can you help me with?" --target-org ${getUsername()} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      expect(result).to.not.be.undefined;
      expect(result?.sessionId).to.be.a('string').and.not.be.empty;
      expect(result?.response).to.be.a('string').and.not.be.empty;
    });

    it('should send utterance and return response (Published agent)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const org = await Org.create({ aliasOrUsername: getUsername() });
      const connection = org.getConnection();

      // Find the published agent from the publish test (starts with "Test_Agent_")
      const publishedAgents = await Agent.listRemote(connection);
      const publishedAgent = publishedAgents.find((agent) => agent.DeveloperName?.startsWith('Test_Agent_'));

      expect(publishedAgent).to.not.be.undefined;
      expect(publishedAgent?.DeveloperName).to.be.a('string');

      // Activate the published agent (required before preview)
      execCmd(`agent activate --api-name ${publishedAgent!.DeveloperName} --target-org ${getUsername()} --json`, {
        ensureExitCode: 0,
      });

      const result = execCmd<AgentPreviewResult>(
        `agent preview --api-name ${
          publishedAgent!.DeveloperName
        } --utterance "What can you help me with?" --target-org ${getUsername()} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      expect(result).to.not.be.undefined;
      expect(result?.sessionId).to.be.a('string').and.not.be.empty;
      expect(result?.response).to.be.a('string').and.not.be.empty;
    });
  });
});
