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
import type { AgentValidateAuthoringBundleResult } from '../../src/commands/agent/validate/authoring-bundle.js';

describe('agent validate authoring-bundle NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
      // scratchOrgs: [
      //   {
      //     setDefault: true,
      //     config: join('config', 'project-scratch-def.json'),
      //   },
      // ],
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should validate a valid authoring bundle', () => {
    // until we're testing in scratch orgs, use the devhub
    const username = session.hubOrg.username;

    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name valid --target-org ${username} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.errors).to.be.undefined;
  });

  it('should fail validation for invalid bundle path', () => {
    // until we're testing in scratch orgs, use the devhub
    const username = session.hubOrg.username;
    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name invalid --target-org ${username} --json`,
      { ensureExitCode: 2 }
    ).jsonOutput!;

    expect(result?.stack).to.include('Error: Compilation of the Agent Script file failed with the following');
    expect(result?.stack).to.include('Auto transitions require a description.');
    expect(result?.stack).to.include("to the target topic 'share_local_events'");
  });
});
