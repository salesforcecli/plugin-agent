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
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentTestCreateResult } from '../../src/commands/agent/test/create.js';
import { getDevhubUsername } from './shared-setup.js';

const isWindows = process.platform === 'win32';

describe('agent test create NUTs', () => {
  let session: TestSession;

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

  (isWindows ? it.skip : it)('should create test from test spec file', async () => {
    const username = getDevhubUsername(session);
    const testApiName = genUniqueString('Test_Agent_%s');
    // Use the existing test spec file from the mock project
    const specPath = join(session.project.dir, 'specs', 'testSpec.yaml');

    // Normalize path for cross-platform compatibility (Windows uses backslashes)
    const normalizedSpecPath = normalize(specPath).replace(/\\/g, '/');
    // Don't quote --api-name on Windows - it can cause parsing issues
    // Only quote --spec path since it may contain spaces
    const commandResult = execCmd<AgentTestCreateResult>(
      `agent test create --api-name ${testApiName} --spec "${normalizedSpecPath}" --target-org ${username} --json`,
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
    const username = getDevhubUsername(session);
    const testApiName = genUniqueString('Test_Agent_%s');
    const invalidSpecPath = join(session.project.dir, 'invalid', 'testSpec.yaml');

    const normalizedInvalidSpecPath = normalize(invalidSpecPath).replace(/\\/g, '/');
    execCmd<AgentTestCreateResult>(
      `agent test create --api-name ${testApiName} --spec "${normalizedInvalidSpecPath}" --target-org ${username} --json`,
      { ensureExitCode: 1 }
    );
  });

  it('should fail when required flags are missing in JSON mode', async () => {
    const username = getDevhubUsername(session);

    // Missing --api-name
    execCmd<AgentTestCreateResult>(`agent test create --target-org ${username} --json`, { ensureExitCode: 1 });

    // Missing --spec
    const testApiName = genUniqueString('Test_Agent_%s');
    execCmd<AgentTestCreateResult>(`agent test create --api-name ${testApiName} --target-org ${username} --json`, {
      ensureExitCode: 1,
    });
  });
});
