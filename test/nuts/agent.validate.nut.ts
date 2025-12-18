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
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentValidateAuthoringBundleResult } from '../../src/commands/agent/validate/authoring-bundle.js';
import type { AgentGenerateAuthoringBundleResult } from '../../src/commands/agent/generate/authoring-bundle.js';

describe('agent validate authoring-bundle NUTs', () => {
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

  it('should validate a valid authoring bundle', async () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');
    const specFileName = genUniqueString('agentSpec_%s.yaml');
    const bundleName = genUniqueString('Test_Bundle_%s');
    const specPath = join(session.project.dir, 'specs', specFileName);

    // First generate a spec file
    const specCommand = `agent generate agent-spec --target-org ${username} --type customer --role "test agent role" --company-name "Test Company" --company-description "Test Description" --output-file ${specPath} --json`;
    execCmd(specCommand, { ensureExitCode: 0 });

    // Generate the authoring bundle
    const generateCommand = `agent generate authoring-bundle --spec ${specPath} --name "${bundleName}" --api-name ${bundleName} --target-org ${username} --json`;
    const generateResult = execCmd<AgentGenerateAuthoringBundleResult>(generateCommand, {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    expect(generateResult).to.be.ok;

    // Now validate the authoring bundle
    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name ${bundleName} --target-org ${username} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.errors).to.be.undefined;
  });

  it('should fail validation for invalid bundle api-name', () => {
    const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
    if (!username) throw new Error('Devhub username not found');
    const invalidApiName = 'Invalid_Bundle_Name_That_Does_Not_Exist';

    execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name ${invalidApiName} --target-org ${username} --json`,
      { ensureExitCode: 1 }
    );
  });
});
