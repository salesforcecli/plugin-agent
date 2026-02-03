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

import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentGenerateAuthoringBundleResult } from '../../src/commands/agent/generate/authoring-bundle.js';
import { getTestSession, getUsername } from './shared-setup.js';

let session: TestSession;

describe('agent generate authoring-bundle NUTs', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    session = await getTestSession();
  });

  it('should generate authoring bundle from spec file', async () => {
    const specFileName = 'agentSpec.yaml';
    const bundleName = genUniqueString('Test_Bundle_%s');
    const specPath = join(session.project.dir, 'specs', specFileName);

    // Now generate the authoring bundle
    const command = `agent generate authoring-bundle --spec ${specPath} --name "${bundleName}" --api-name ${bundleName} --target-org ${getUsername()} --json`;
    const result = execCmd<AgentGenerateAuthoringBundleResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.agentPath).to.be.ok;
    expect(result?.metaXmlPath).to.be.ok;
    expect(result?.outputDir).to.be.ok;

    // Verify files exist
    expect(existsSync(result!.agentPath)).to.be.true;
    expect(existsSync(result!.metaXmlPath)).to.be.true;

    // Verify file contents
    const agent = readFileSync(result!.agentPath, 'utf8');
    const metaXml = readFileSync(result!.metaXmlPath, 'utf8');
    expect(agent).to.be.ok;
    expect(metaXml).to.include('<AiAuthoringBundle');
    expect(metaXml).to.include('<bundleType>AGENT</bundleType>');
    expect(agent).to.include(`developer_name: "${bundleName}"`);
  });

  it('should generate authoring bundle from --spec no-spec', async () => {
    const bundleName = genUniqueString('Test_Bundle_NoSpec_%s');

    const command = `agent generate authoring-bundle --spec no-spec --name "${bundleName}" --api-name ${bundleName} --target-org ${getUsername()} --json`;
    const result = execCmd<AgentGenerateAuthoringBundleResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.agentPath).to.be.ok;
    expect(result?.metaXmlPath).to.be.ok;
    expect(result?.outputDir).to.be.ok;

    expect(existsSync(result!.agentPath)).to.be.true;
    expect(existsSync(result!.metaXmlPath)).to.be.true;

    const agent = readFileSync(result!.agentPath, 'utf8');
    const metaXml = readFileSync(result!.metaXmlPath, 'utf8');
    expect(agent).to.be.ok;
    expect(metaXml).to.include('<AiAuthoringBundle');
    expect(metaXml).to.include('<bundleType>AGENT</bundleType>');
    expect(agent).to.include(`developer_name: "${bundleName}"`);
  });
});
