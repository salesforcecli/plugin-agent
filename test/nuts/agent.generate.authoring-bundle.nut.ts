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
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentGenerateAuthoringBundleResult } from '../../src/commands/agent/generate/authoring-bundle.js';

let session: TestSession;

describe('agent generate authoring-bundle NUTs', () => {
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

  describe.skip('agent generate authoring-bundle', () => {
    it('should generate authoring bundle from spec file', async () => {
      const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
      if (!username) throw new Error('Devhub username not found');
      const specFileName = genUniqueString('agentSpec_%s.yaml');
      const bundleName = genUniqueString('Test_Bundle_%s');
      const specPath = join(session.project.dir, 'specs', specFileName);

      // First generate a spec file
      const specCommand = `agent generate agent-spec --target-org ${username} --type customer --role "test agent role" --company-name "Test Company" --company-description "Test Description" --output-file ${specPath} --json`;
      execCmd(specCommand, { ensureExitCode: 0 });

      // Now generate the authoring bundle
      const command = `agent generate authoring-bundle --spec ${specPath} --name "${bundleName}" --api-name ${bundleName} --target-org ${username} --json`;
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
      expect(metaXml).to.include('<aiAuthoringBundle>');
      expect(metaXml).to.include(bundleName);
    });

    it('should use default output directory when not specified', async () => {
      const username = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')?.username;
      if (!username) throw new Error('Devhub username not found');
      const specFileName = genUniqueString('agentSpec_%s.yaml');
      const bundleName = genUniqueString('Test_Bundle_%s');
      const specPath = join(session.project.dir, 'specs', specFileName);
      const defaultPath = join('force-app', 'main', 'default', 'aiAuthoringBundles');

      // First generate a spec file
      const specCommand = `agent generate agent-spec --target-org ${username} --type customer --role "test agent role" --company-name "Test Company" --company-description "Test Description" --output-file ${specPath} --json`;
      execCmd(specCommand, { ensureExitCode: 0 });

      const command = `agent generate authoring-bundle --spec ${specPath} --name "${bundleName}" --target-org ${username} --json`;
      const result = execCmd<AgentGenerateAuthoringBundleResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

      expect(result).to.be.ok;
      expect(result?.outputDir).to.include(defaultPath);
    });
  });
});
