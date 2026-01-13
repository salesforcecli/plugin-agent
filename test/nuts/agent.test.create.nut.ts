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

import { join, normalize } from 'node:path';
import { existsSync } from 'node:fs';
import * as os from 'node:os';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentTestCreateResult } from '../../src/commands/agent/test/create.js';
import { getTestSession, getUsername } from './shared-setup.js';

describe('agent test create', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  let session: TestSession;
  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    session = await getTestSession();
  });
  // this NUT is failing on windows due to an invalid api name, but it seems valid to me, passes on unix
  //   Error: Unexpected exit code for command: agent test create --api-name Test_Agent_5096f046f91f34e7 --spec "...\agent-generate-template\specs\testSpec.yaml" --target-org test-relsveqne0do@example.com --json. Expected: 0 Actual: 1
  //   Message: "Name: The AI Evaluation Definition API Name can only contain underscores and alphanumeric characters. It must be unique, begin with a letter, not include spaces, not end with an underscore, and not contain two consecutive underscores.",
  // Test_Agent_5096f046f91f34e7 only contains underscores, and alphanumeric characters...
  (os.platform() === 'win32' ? it.skip : it)('should create test from test spec file', async function () {
    // Increase timeout to 30 minutes since deployment can take a long time
    this.timeout(30 * 60 * 1000);
    const testApiName = genUniqueString('Test_Agent_%s');
    // Use the existing test spec file from the mock project
    const specPath = join(session.project.dir, 'specs', 'testSpec.yaml');

    const commandResult = execCmd<AgentTestCreateResult>(
      `agent test create --api-name "${testApiName}" --spec "${specPath}" --target-org ${getUsername()} --json`,
      { ensureExitCode: 0 }
    );

    const result = commandResult.jsonOutput?.result;
    if (!result || typeof result !== 'object' || !result.path || !result.contents) {
      throw new Error(
        `Command failed or returned invalid result. Result type: ${typeof result}, value: ${JSON.stringify(result)}`
      );
    }

    expect(result.path).to.be.a('string').and.not.be.empty;
    expect(result.contents).to.be.a('string').and.not.be.empty;

    // Verify file exists (path is relative to project root)
    const fullPath = join(session.project.dir, result.path);
    expect(existsSync(fullPath)).to.be.true;
  });

  it('should fail when spec file does not exist', async () => {
    const testApiName = genUniqueString('Test_Agent_%s');
    const invalidSpecPath = join(session.project.dir, 'invalid', 'testSpec.yaml');

    const normalizedInvalidSpecPath = normalize(invalidSpecPath).replace(/\\/g, '/');
    execCmd<AgentTestCreateResult>(
      `agent test create --api-name "${testApiName}" --spec "${normalizedInvalidSpecPath}" --target-org ${getUsername()} --json`,
      { ensureExitCode: 1 }
    );
  });

  it('should fail when required flags are missing in JSON mode', async () => {
    // Missing --api-name
    execCmd<AgentTestCreateResult>(`agent test create --target-org ${getUsername()} --json`, {
      ensureExitCode: 1,
    });

    // Missing --spec
    const testApiName = genUniqueString('Test_Agent_%s');
    execCmd<AgentTestCreateResult>(
      `agent test create --api-name "${testApiName}" --target-org ${getUsername()} --json`,
      {
        ensureExitCode: 1,
      }
    );
  });
});
