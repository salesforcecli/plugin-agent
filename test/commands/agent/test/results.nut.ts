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
import { AgentTestResultsResult } from '../../../../src/commands/agent/test/results.js';
import { AgentTestCache } from '../../../../src/agentTestCache.js';

describe('agent test results NUTs', () => {
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

  it('should get results of completed test run', async () => {
    const runResult = execCmd<AgentTestRunResult>(
      `agent test run --name my_agent_tests --target-org ${session.hubOrg.username} --wait 5 --json`,
      {
        ensureExitCode: 0,
        env: { ...process.env, SF_MOCK_DIR: mockDir },
      }
    ).jsonOutput;

    expect(runResult?.result.aiEvaluationId).to.be.ok;
    expect(runResult?.result.status.toLowerCase()).to.equal('completed');

    const output = execCmd<AgentTestResultsResult>(
      `agent test results --job-id ${runResult?.result.aiEvaluationId} --target-org ${session.hubOrg.username} --json`,
      {
        ensureExitCode: 0,
        env: { ...process.env, SF_MOCK_DIR: mockDir },
      }
    ).jsonOutput;

    expect(output?.result.status.toLowerCase()).to.equal('completed');
    expect(output?.result.testSet.testCases.length).to.equal(2);

    // check that cache does not have an entry
    const cache = await AgentTestCache.create();
    expect(() => cache.resolveFromCache()).to.throw('Could not find an aiEvaluationId to resume');
  });
});
