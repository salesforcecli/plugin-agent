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
import { existsSync, writeFileSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentTestCreateResult } from '../../src/commands/agent/test/create.js';

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

  it('should create test from test spec file', async () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');
    const testApiName = genUniqueString('Test_Agent_%s');
    const specFileName = genUniqueString('testSpec_%s.yaml');
    const specPath = join(session.project.dir, 'specs', specFileName);

    // Create a minimal test spec file
    // Note: Using an agent that should exist in the devhub (Willie_Resort_Manager)
    const testSpecContent = `name: Test Agent Test
description: Test description
subjectType: AGENT
subjectName: Willie_Resort_Manager
testCases:
  - utterance: "What is the weather?"
    expectedTopic: Weather_and_Temperature_Information
    expectedActions: []
    expectedOutcome: "The agent should provide weather information"
`;
    writeFileSync(specPath, testSpecContent);

    const commandResult = execCmd<AgentTestCreateResult>(
      `agent test create --api-name ${testApiName} --spec ${specPath} --target-org ${username} --json`,
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

  it('should fail when spec file does not exist', () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');
    const testApiName = genUniqueString('Test_Agent_%s');
    const invalidSpecPath = join(session.project.dir, 'invalid', 'testSpec.yaml');

    execCmd<AgentTestCreateResult>(
      `agent test create --api-name ${testApiName} --spec ${invalidSpecPath} --target-org ${username} --json`,
      { ensureExitCode: 1 }
    );
  });

  it('should fail when required flags are missing in JSON mode', () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');

    // Missing --api-name
    execCmd<AgentTestCreateResult>(`agent test create --target-org ${username} --json`, { ensureExitCode: 1 });

    // Missing --spec
    const testApiName = genUniqueString('Test_Agent_%s');
    execCmd<AgentTestCreateResult>(`agent test create --api-name ${testApiName} --target-org ${username} --json`, {
      ensureExitCode: 1,
    });
  });
});
