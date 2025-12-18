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
import { expect } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { AgentTestCache } from '../../src/agentTestCache.js';
import type { AgentTestListResult } from '../../src/commands/agent/test/list.js';
import type { AgentTestResultsResult } from '../../src/commands/agent/test/results.js';
import type { AgentTestRunResult } from '../../src/flags.js';

/* eslint-disable no-console */

describe('agent test NUTs', () => {
  let session: TestSession;
  let devhubUsername: string;
  const agentTestName = 'Local_Info_Agent_Test';

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
    });
    devhubUsername = process.env.TESTKIT_HUB_USERNAME ?? session.orgs.get('devhub')!.username!;
  });

  after(async () => {
    await session?.clean();
  });

  describe('agent test list', () => {
    it('should list agent tests in org', async () => {
      const result = execCmd<AgentTestListResult>(`agent test list --target-org ${devhubUsername} --json`, {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      expect(result).to.be.ok;
      expect(result?.length).to.be.greaterThanOrEqual(1);
      expect(result?.at(0)?.type).to.include('AiEvaluationDefinition');
    });
  });

  describe('agent test run', () => {
    it('should start async test run', async () => {
      const command = `agent test run --api-name ${agentTestName} --target-org ${devhubUsername} --json`;
      const output = execCmd<AgentTestRunResult>(command, {
        ensureExitCode: 0,
      }).jsonOutput;
      expect(output?.result.status).to.equal('NEW');
      expect(output?.result.runId.startsWith('4KB')).to.be.true;

      // check cache for test run entry
      const cache = await AgentTestCache.create();
      const testRun = cache.resolveFromCache();
      expect(testRun.runId.startsWith('4KB')).to.be.true;
      expect(testRun.name).to.equal(agentTestName);
    });

    it('should poll for test run completion when --wait is used', async () => {
      const command = `agent test run --api-name ${agentTestName} --target-org ${devhubUsername} --wait 5 --json`;
      const output = execCmd<AgentTestRunResult>(command, {
        ensureExitCode: 0,
      }).jsonOutput;

      expect(output?.result.status).to.equal('COMPLETED');
      expect(output?.result.runId.startsWith('4KB')).to.be.true;
    });
  });

  describe('agent test results', () => {
    it('should get results of completed test run', async () => {
      // Ensure cache is cleared before running the test
      const cache = await AgentTestCache.create();
      cache.clear();

      const runResult = execCmd<AgentTestRunResult>(
        `agent test run --api-name ${agentTestName} --target-org ${devhubUsername} --wait 5 --json`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;

      expect(runResult?.result.runId).to.be.ok;
      expect(runResult?.result.status.toLowerCase()).to.equal('completed');

      const output = execCmd<AgentTestResultsResult>(
        `agent test results --job-id ${runResult?.result.runId} --target-org ${devhubUsername} --json`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;

      expect(output?.result.status.toLowerCase()).to.equal('completed');
      expect(output?.result.testCases.length).to.equal(2);

      // check that cache does not have an entry
      expect(() => cache.resolveFromCache()).to.throw('Could not find a runId to resume');
    });
  });

  describe('agent test resume', () => {
    it('should resume async test run', async () => {
      // Ensure cache is cleared before running the test
      const cache = await AgentTestCache.create();
      cache.clear();

      const runResult = execCmd<AgentTestRunResult>(
        `agent test run --api-name ${agentTestName} --target-org ${devhubUsername} --json`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;

      expect(runResult?.result.runId).to.be.ok;

      const output = execCmd<AgentTestRunResult>(
        `agent test resume --job-id ${runResult?.result.runId} --target-org ${devhubUsername} --json`,
        {
          ensureExitCode: 0,
        }
      ).jsonOutput;

      expect(output?.result.status).to.equal('COMPLETED');
      expect(output?.result.runId.startsWith('4KB')).to.be.true;

      // check that cache does not have an entry
      expect(() => cache.resolveFromCache()).to.throw('Could not find a runId to resume');
    });
  });
});
