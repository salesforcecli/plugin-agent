/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { expect } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentValidateAuthoringBundleResult } from '../../src/commands/agent/validate/authoring-bundle.js';

describe.skip('agent validate authoring-bundle NUTs', () => {
  let session: TestSession;

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

  it('should validate a valid authoring bundle', () => {
    const username = session.orgs.get('default')!.username as string;
    const bundlePath = join(session.project.dir, 'force-app', 'main', 'default', 'authoringbundles');

    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name ${bundlePath} --target-org ${username} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.errors).to.be.undefined;
  });

  it('should fail validation for invalid bundle path', () => {
    const username = session.orgs.get('default')!.username as string;
    const bundlePath = join(session.project.dir, 'invalid', 'path');

    execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name ${bundlePath} --target-org ${username} --json`,
      { ensureExitCode: 1 }
    );
  });
});
