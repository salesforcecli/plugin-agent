/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentTestCache } from '../../../../src/agentTestCache.js';
import type { AgentTestRunResult } from '../../../../src/flags.js';

describe('agent test resume NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { sourceDir: join('test', 'mock-projects', 'agent-generate-template') },
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should resume async test run', async () => {
    const runResult = execCmd<AgentTestRunResult>(
      `agent test run --api-name guest_experience_agent_test --target-org ${session.hubOrg.username} --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput;

    expect(runResult?.result.runId).to.be.ok;

    const output = execCmd<AgentTestRunResult>(
      `agent test resume --job-id ${runResult?.result.runId} --target-org ${session.hubOrg.username} --json`,
      {
        ensureExitCode: 0,
      }
    ).jsonOutput;

    expect(output?.result.status).to.equal('COMPLETED');
    expect(output?.result.runId.startsWith('4KB')).to.be.true;

    // check that cache does not have an entry
    const cache = await AgentTestCache.create();
    expect(() => cache.resolveFromCache()).to.throw('Could not find a runId to resume');
  });
});
