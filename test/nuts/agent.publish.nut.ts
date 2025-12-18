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
import { expect } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentPublishAuthoringBundleResult } from '../../src/commands/agent/publish/authoring-bundle.js';

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

  it('should publish a valid authoring bundle', async () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');

    // Publish the existing Willie_Resort_Manager authoring bundle
    // Note: This may fail if the agent already exists or if there are validation issues
    // In a devhub, we may need to handle existing agents differently
    try {
      const result = execCmd<AgentPublishAuthoringBundleResult>(
        `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${username} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput?.result;

      expect(result).to.be.ok;
      expect(result?.success).to.be.true;
      expect(result?.botDeveloperName).to.be.a('string');
      expect(result?.errors).to.be.undefined;
    } catch (error) {
      // If publish fails, it might be because the agent already exists
      // Check if it's a deployment error vs a different error
      const errorOutput = execCmd<AgentPublishAuthoringBundleResult>(
        `agent publish authoring-bundle --api-name ${bundleApiName} --target-org ${username} --json`,
        { ensureExitCode: 2 }
      ).jsonOutput;

      // For now, we'll skip this test if it fails - it may need the agent to be set up first
      // or the authoring bundle may need to be valid for the devhub
      // eslint-disable-next-line no-console
      console.log('Publish failed, may need agent setup:', errorOutput?.message);
      throw error;
    }
  });

  it('should fail for invalid bundle api-name', () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');
    const invalidApiName = 'Invalid_Bundle_Name_That_Does_Not_Exist';

    execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --api-name ${invalidApiName} --target-org ${username} --json`,
      { ensureExitCode: 1 }
    );
  });
});
