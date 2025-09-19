/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { expect } from 'chai';
import { genUniqueString, TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentGenerateAuthoringBundleResult } from '../../src/commands/agent/generate/authoring-bundle.js';

let session: TestSession;

describe.skip('agent generate authoring-bundle NUTs', () => {
  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          setDefault: true,
          config: join('config', 'project-scratch-def.json'),
        },
      ],
    });
  });

  after(async () => {
    await session?.clean();
  });

  describe('agent generate authoring-bundle', () => {
    const specFileName = genUniqueString('agentSpec_%s.yaml');
    const bundleName = 'Test_Bundle';

    it('should generate authoring bundle from spec file', async () => {
      const username = session.orgs.get('default')!.username as string;
      const specPath = join(session.project.dir, 'specs', specFileName);

      // First generate a spec file
      const specCommand = `agent generate agent-spec --target-org ${username} --type customer --role "test agent role" --company-name "Test Company" --company-description "Test Description" --output-file ${specPath} --json`;
      execCmd(specCommand, { ensureExitCode: 0 });

      // Now generate the authoring bundle
      const command = `agent generate authoring-bundle --spec ${specPath} --name ${bundleName} --target-org ${username} --json`;
      const result = execCmd<AgentGenerateAuthoringBundleResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

      expect(result).to.be.ok;
      expect(result?.afScriptPath).to.be.ok;
      expect(result?.metaXmlPath).to.be.ok;
      expect(result?.outputDir).to.be.ok;

      // Verify files exist
      expect(existsSync(result!.afScriptPath)).to.be.true;
      expect(existsSync(result!.metaXmlPath)).to.be.true;

      // Verify file contents
      const afScript = readFileSync(result!.afScriptPath, 'utf8');
      const metaXml = readFileSync(result!.metaXmlPath, 'utf8');
      expect(afScript).to.be.ok;
      expect(metaXml).to.include('<aiAuthoringBundle>');
      expect(metaXml).to.include(bundleName);
    });

    it('should use default output directory when not specified', async () => {
      const username = session.orgs.get('default')!.username as string;
      const specPath = join(session.project.dir, 'specs', specFileName);
      const defaultPath = join('force-app', 'main', 'default', 'aiAuthoringBundle');

      const command = `agent generate authoring-bundle --spec ${specPath} --name ${bundleName} --target-org ${username} --json`;
      const result = execCmd<AgentGenerateAuthoringBundleResult>(command, { ensureExitCode: 0 }).jsonOutput?.result;

      expect(result).to.be.ok;
      expect(result?.outputDir).to.include(defaultPath);
    });
  });
});
