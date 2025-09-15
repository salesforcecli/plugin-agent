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
import type { AgentPublishAuthoringBundleResult } from '../../src/commands/agent/publish/authoring-bundle.js';

describe.skip('agent publish authoring-bundle NUTs', () => {
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

  it('should publish a valid authoring bundle', () => {
    const bundlePath = join(session.project.dir, 'force-app', 'main', 'default', 'authoringbundles');

    const result = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --bundle-path ${bundlePath} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
    expect(result?.botDeveloperName).to.be.a('string');
    expect(result?.errors).to.be.undefined;
  });

  it('should fail for invalid bundle path', () => {
    const username = session.orgs.get('default')!.username as string;
    const bundlePath = join(session.project.dir, 'invalid', 'path');
    const agentName = 'Test Agent';

    const result = execCmd<AgentPublishAuthoringBundleResult>(
      `agent publish authoring-bundle --bundle-path ${bundlePath} --agent-name "${agentName}" --target-org ${username} --json`,
      { ensureExitCode: 1 }
    ).jsonOutput;

    expect(result!.exitCode).to.equal(1);
    expect(JSON.stringify(result)).to.include('Invalid bundle path');
  });
});
