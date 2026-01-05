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
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentValidateAuthoringBundleResult } from '../../src/commands/agent/validate/authoring-bundle.js';
import { getTestSession } from './shared-setup.js';

describe('agent validate authoring-bundle NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await getTestSession();
  });

  it('should validate a valid authoring bundle', async () => {
    // Use the existing Willie_Resort_Manager authoring bundle
    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name Willie_Resort_Manager --target-org ${
        session.orgs.get('default')?.username
      } --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.errors).to.be.undefined;
  });

  it('should fail validation for invalid authoring bundle', async () => {
    // Use the invalid authoring bundle (expects exit code 2 for compilation errors)
    execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name invalid --target-org ${session.orgs.get('default')?.username} --json`,
      { ensureExitCode: 2 }
    );
  });
});
