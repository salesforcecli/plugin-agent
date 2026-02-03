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
import { sleep } from '@salesforce/kit';
import type { AgentValidateAuthoringBundleResult } from '../../src/commands/agent/validate/authoring-bundle.js';
import { getTestSession, getUsername } from './shared-setup.js';

describe('agent validate authoring-bundle NUTs', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    await getTestSession();
  });

  it('should validate a valid authoring bundle', async function () {
    // Retry up to 3 times total (1 initial + 2 retries) to handle transient failures
    // Windows CI can be slower, so retries help handle timing issues
    this.retries(2);

    // Add a small delay on Windows before running the test to ensure API is ready
    if (process.platform === 'win32') {
      await sleep(30 * 1000); // Wait 30 seconds on Windows
    }

    // Use the existing Willie_Resort_Manager authoring bundle
    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name Willie_Resort_Manager --target-org ${getUsername()} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.errors).to.be.undefined;
  });

  it('should fail validation for invalid authoring bundle', async function () {
    // Retry up to 3 times total (1 initial + 2 retries) to handle transient failures
    this.retries(2);

    // Use the invalid authoring bundle (expects exit code 2 for compilation errors)
    execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name invalid --target-org ${getUsername()} --json`,
      { ensureExitCode: 'nonZero' }
    );
  });
});
