/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentTestListResult } from '../../../../src/commands/agent/test/list.js';

describe('agent test list NUTs', () => {
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

  it('should list agent tests in org', async () => {
    const result = execCmd<AgentTestListResult>('agent test list --json', { ensureExitCode: 0 }).jsonOutput?.result;
    expect(result).to.be.ok;
    expect(result?.length).to.be.greaterThan(1);
    expect(result?.at(0)?.type).to.include('AiEvaluationDefinition');
  });
});
