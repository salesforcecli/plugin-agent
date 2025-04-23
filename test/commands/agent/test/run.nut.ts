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

describe('agent test run NUTs', () => {
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

  it('should start async test run', async () => {
    const name = 'guest_experience_agent_test';
    const command = `agent test run --api-name ${name} --target-org ${session.hubOrg.username} --json`;
    const output = execCmd<AgentTestRunResult>(command, {
      ensureExitCode: 0,
    }).jsonOutput;
    expect(output?.result.status).to.equal('NEW');
    expect(output?.result.runId.startsWith('4KB')).to.be.true;

    // check cache for test run entry
    const cache = await AgentTestCache.create();
    const testRun = cache.resolveFromCache();
    expect(testRun.runId.startsWith('4KB')).to.be.true;
    expect(testRun.name).to.equal(name);
  });

  it('should poll for test run completion when --wait is used', async () => {
    const command = `agent test run --api-name guest_experience_agent_test --target-org ${session.hubOrg.username} --wait 5 --json`;
    const output = execCmd<AgentTestRunResult>(command, {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(output?.result.status).to.equal('COMPLETED');
    expect(output?.result.runId.startsWith('4KB')).to.be.true;
  });
});
