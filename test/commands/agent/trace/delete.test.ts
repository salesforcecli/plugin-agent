/*
 * Copyright 2026, Salesforce, Inc.
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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';

const MOCK_PROJECT_DIR = join(process.cwd(), 'test', 'mock-projects', 'agent-generate-template');

// Dates relative to now so --older-than arithmetic stays correct over time.
// RECENT_MTIME: 7 days ago — older than 1h but newer than 28d/30d
// OLD_MTIME:    60 days ago — older than all thresholds used in tests
const RECENT_MTIME = new Date(Date.now() - 7 * 86_400_000);
const OLD_MTIME = new Date(Date.now() - 60 * 86_400_000);

const MOCK_TRACES_AGENT_A = [
  { planId: 'plan-1', path: '/sfdx/agents/AgentA/sessions/sess-1/traces/plan-1.json', size: 1000, mtime: RECENT_MTIME },
  { planId: 'plan-2', path: '/sfdx/agents/AgentA/sessions/sess-1/traces/plan-2.json', size: 2000, mtime: OLD_MTIME },
];
const MOCK_TRACES_AGENT_B = [
  { planId: 'plan-3', path: '/sfdx/agents/AgentB/sessions/sess-2/traces/plan-3.json', size: 3000, mtime: OLD_MTIME },
];

const MOCK_CACHED_SESSIONS = [
  {
    agentId: 'AgentA',
    displayName: 'My_Agent_A',
    sessions: [{ sessionId: 'sess-1', timestamp: RECENT_MTIME.toISOString() }],
  },
  {
    agentId: 'AgentB',
    displayName: 'My_Agent_B',
    sessions: [{ sessionId: 'sess-2', timestamp: OLD_MTIME.toISOString() }],
  },
];

const MOCK_ALL_SESSIONS = MOCK_CACHED_SESSIONS.flatMap(({ agentId, displayName, sessions }) =>
  sessions.map(({ sessionId }) => ({ agentId, displayName, sessionId }))
);

describe('agent trace delete', () => {
  const $$ = new TestContext();
  let unlinkStub: sinon.SinonStub;
  let listAllAgentSessionsStub: sinon.SinonStub;
  let listSessionTracesStub: sinon.SinonStub;
  let yesNoOrCancelStub: sinon.SinonStub;
  let AgentTraceDelete: any;

  beforeEach(async () => {
    unlinkStub = $$.SANDBOX.stub().resolves();
    listAllAgentSessionsStub = $$.SANDBOX.stub().resolves(MOCK_ALL_SESSIONS);
    listSessionTracesStub = $$.SANDBOX.stub();
    listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves(MOCK_TRACES_AGENT_A);
    listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves(MOCK_TRACES_AGENT_B);
    yesNoOrCancelStub = $$.SANDBOX.stub().resolves(true);

    const mod = await esmock('../../../../src/commands/agent/trace/delete.js', {
      'node:fs/promises': { unlink: unlinkStub },
      '../../../../src/agentSessionScanner.js': {
        listAllAgentSessions: listAllAgentSessionsStub,
      },
      '@salesforce/agents': {
        listSessionTraces: listSessionTracesStub,
      },
      '../../../../src/yes-no-cancel.js': { default: yesNoOrCancelStub },
    });

    AgentTraceDelete = mod.default;

    $$.inProject(true);
    const mockProject = { getPath: () => MOCK_PROJECT_DIR } as unknown as SfProject;
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('with no filters', () => {
    it('deletes all traces across all agents when --no-prompt is set', async () => {
      const result = await AgentTraceDelete.run(['--no-prompt']);
      expect(result).to.have.length(3);
      expect(unlinkStub.callCount).to.equal(3);
    });

    it('prompts for confirmation by default', async () => {
      await AgentTraceDelete.run([]);
      expect(yesNoOrCancelStub.calledOnce).to.be.true;
    });

    it('does not delete when user declines confirmation', async () => {
      yesNoOrCancelStub.resolves(false);
      const result = await AgentTraceDelete.run([]);
      expect(result).to.deep.equal([]);
      expect(unlinkStub.called).to.be.false;
    });

    it('does not delete when user cancels confirmation', async () => {
      yesNoOrCancelStub.resolves('cancel');
      const result = await AgentTraceDelete.run([]);
      expect(result).to.deep.equal([]);
      expect(unlinkStub.called).to.be.false;
    });

    it('returns empty and does not prompt when no traces exist', async () => {
      listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves([]);
      listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves([]);
      const result = await AgentTraceDelete.run([]);
      expect(result).to.deep.equal([]);
      expect(yesNoOrCancelStub.called).to.be.false;
      expect(unlinkStub.called).to.be.false;
    });
  });

  describe('--no-prompt', () => {
    it('skips the confirmation prompt', async () => {
      await AgentTraceDelete.run(['--no-prompt']);
      expect(yesNoOrCancelStub.called).to.be.false;
    });
  });

  describe('--agent filter', () => {
    it('deletes only traces for the matching agent', async () => {
      const result = await AgentTraceDelete.run(['--agent', 'My_Agent_A', '--no-prompt']);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.agent === 'My_Agent_A')).to.be.true;
      expect(unlinkStub.callCount).to.equal(2);
    });

    it('uses case-insensitive substring match', async () => {
      const result = await AgentTraceDelete.run(['--agent', 'agent_a', '--no-prompt']);
      expect(result).to.have.length(2);
    });

    it('returns empty when no agents match', async () => {
      const result = await AgentTraceDelete.run(['--agent', 'NonExistent', '--no-prompt']);
      expect(result).to.deep.equal([]);
      expect(unlinkStub.called).to.be.false;
    });
  });

  describe('--session-id filter', () => {
    it('deletes only traces for the specified session', async () => {
      const result = await AgentTraceDelete.run(['--session-id', 'sess-2', '--no-prompt']);
      expect(result).to.have.length(1);
      expect(result[0].sessionId).to.equal('sess-2');
    });

    it('returns empty when session ID does not match', async () => {
      const result = await AgentTraceDelete.run(['--session-id', 'no-such-session', '--no-prompt']);
      expect(result).to.deep.equal([]);
    });
  });

  describe('--older-than filter', () => {
    it('deletes only traces older than the duration (days)', async () => {
      const result = await AgentTraceDelete.run(['--older-than', '30d', '--no-prompt']);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-2');
      expect(planIds).to.include('plan-3');
      expect(planIds).to.not.include('plan-1');
    });

    it('deletes nothing when all traces are newer than the duration', async () => {
      const futureMtime = new Date(Date.now() + 86_400_000);
      listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves([
        {
          planId: 'plan-1',
          path: '/sfdx/agents/AgentA/sessions/sess-1/traces/plan-1.json',
          size: 1000,
          mtime: futureMtime,
        },
      ]);
      listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves([]);
      const result = await AgentTraceDelete.run(['--older-than', '1d', '--no-prompt']);
      expect(result).to.deep.equal([]);
    });

    it('accepts hours unit', async () => {
      const result = await AgentTraceDelete.run(['--older-than', '1h', '--no-prompt']);
      expect(result).to.have.length(3);
    });

    it('accepts weeks unit', async () => {
      const result = await AgentTraceDelete.run(['--older-than', '4w', '--no-prompt']);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-2');
      expect(planIds).to.include('plan-3');
      expect(planIds).to.not.include('plan-1');
    });

    it('rejects a value without a unit', async () => {
      try {
        await AgentTraceDelete.run(['--older-than', '7', '--no-prompt']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/invalid.*older-than|InvalidDuration/i);
      }
    });

    it('rejects a non-numeric value', async () => {
      try {
        await AgentTraceDelete.run(['--older-than', 'lastweek', '--no-prompt']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/invalid.*older-than|InvalidDuration/i);
      }
    });
  });

  describe('combined filters', () => {
    it('applies --agent and --older-than together', async () => {
      const result = await AgentTraceDelete.run(['--agent', 'My_Agent_A', '--older-than', '30d', '--no-prompt']);
      expect(result).to.have.length(1);
      expect(result[0].planId).to.equal('plan-2');
    });

    it('applies --session-id and --agent together', async () => {
      const result = await AgentTraceDelete.run(['--agent', 'My_Agent_A', '--session-id', 'sess-1', '--no-prompt']);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.sessionId === 'sess-1')).to.be.true;
    });
  });
});
