/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentTestRunResult } from '../../../../src/commands/agent/test/run.js';
import { AgentTestCache } from '../../../../src/agentTestCache.js';

describe('agent test run NUTs', () => {
  let session: TestSession;
  const mockDir = resolve('test/mocks');

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { name: 'agentTestRun' },
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should start async test run', async () => {
    const name = 'my_agent_tests';
    const command = `agent test run --name ${name} --target-org ${session.hubOrg.username} --json`;
    const output = execCmd<AgentTestRunResult>(command, {
      ensureExitCode: 0,
      env: { ...process.env, SF_MOCK_DIR: mockDir },
    }).jsonOutput;
    expect(output?.result.status).to.equal('NEW');
    expect(output?.result.aiEvaluationId).to.equal('4KBSM000000003F4AQ');

    // check cache for test run entry
    const cache = await AgentTestCache.create();
    const testRun = cache.resolveFromCache();
    expect(testRun.aiEvaluationId).to.equal('4KBSM000000003F4AQ');
    expect(testRun.name).to.equal(name);
  });

  it('should poll for test run completion when --wait is used', async () => {
    const name = 'my_agent_tests';
    const command = `agent test run --name ${name} --target-org ${session.hubOrg.username} --wait 5 --json`;
    const output = execCmd<AgentTestRunResult>(command, {
      ensureExitCode: 0,
      env: { ...process.env, SF_MOCK_DIR: mockDir },
    }).jsonOutput;

    expect(output?.result.status).to.equal('COMPLETED');
    expect(output?.result.aiEvaluationId).to.equal('4KBSM000000003F4AQ');

    // check that cache does not have an entry
    const cache = await AgentTestCache.create();
    expect(() => cache.resolveFromCache()).to.throw('Could not find an aiEvaluationId to resume');
  });
});
