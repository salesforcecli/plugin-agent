/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentTestRunResult } from '../../src/commands/agent/test/run.js';

let testSession: TestSession;

describe('agent test run NUTs', () => {
  before('prepare session', async () => {
    testSession = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          edition: 'developer',
          setDefault: true,
        },
      ],
    });
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should return a job ID', () => {
    const result = execCmd<AgentTestRunResult>('agent test run -i 4KBSM000000003F4AQ --json', { ensureExitCode: 0 })
      .jsonOutput?.result;
    expect(result?.success).to.equal(true);
    expect(result?.jobId).to.be.ok;
  });
});
