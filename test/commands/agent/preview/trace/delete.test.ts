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

// Dates well in the past so --older-than arithmetic is predictable without fake timers.
// RECENT_MTIME: ~23 days ago from 2026-04-30 — caught by 30d but not 7d
// OLD_MTIME:    ~60 days ago from 2026-04-30 — caught by both 7d and 30d
const RECENT_MTIME = new Date('2026-04-07T17:00:00.000Z');
const OLD_MTIME = new Date('2026-03-01T00:00:00.000Z');

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

describe('agent preview trace delete', () => {
  const $$ = new TestContext();
  let unlinkStub: sinon.SinonStub;
  let listCachedPreviewSessionsStub: sinon.SinonStub;
  let listSessionTracesStub: sinon.SinonStub;
  let yesNoOrCancelStub: sinon.SinonStub;
  let AgentPreviewTraceDelete: any;

  beforeEach(async () => {
    unlinkStub = $$.SANDBOX.stub().resolves();
    listCachedPreviewSessionsStub = $$.SANDBOX.stub().resolves(MOCK_CACHED_SESSIONS);
    listSessionTracesStub = $$.SANDBOX.stub();
    listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves(MOCK_TRACES_AGENT_A);
    listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves(MOCK_TRACES_AGENT_B);
    yesNoOrCancelStub = $$.SANDBOX.stub().resolves(true);

    const mod = await esmock('../../../../../src/commands/agent/preview/trace/delete.js', {
      'node:fs/promises': { unlink: unlinkStub },
      '@salesforce/agents': {
        listCachedPreviewSessions: listCachedPreviewSessionsStub,
        listSessionTraces: listSessionTracesStub,
      },
      '../../../../../src/yes-no-cancel.js': { default: yesNoOrCancelStub },
    });

    AgentPreviewTraceDelete = mod.default;

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
      const result = await AgentPreviewTraceDelete.run(['--no-prompt']);
      expect(result).to.have.length(3);
      expect(unlinkStub.callCount).to.equal(3);
    });

    it('prompts for confirmation by default', async () => {
      await AgentPreviewTraceDelete.run([]);
      expect(yesNoOrCancelStub.calledOnce).to.be.true;
    });

    it('does not delete when user declines confirmation', async () => {
      yesNoOrCancelStub.resolves(false);
      const result = await AgentPreviewTraceDelete.run([]);
      expect(result).to.deep.equal([]);
      expect(unlinkStub.called).to.be.false;
    });

    it('does not delete when user cancels confirmation', async () => {
      yesNoOrCancelStub.resolves('cancel');
      const result = await AgentPreviewTraceDelete.run([]);
      expect(result).to.deep.equal([]);
      expect(unlinkStub.called).to.be.false;
    });

    it('returns empty and does not prompt when no traces exist', async () => {
      listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves([]);
      listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves([]);
      const result = await AgentPreviewTraceDelete.run([]);
      expect(result).to.deep.equal([]);
      expect(yesNoOrCancelStub.called).to.be.false;
      expect(unlinkStub.called).to.be.false;
    });
  });

  describe('--no-prompt', () => {
    it('skips the confirmation prompt', async () => {
      await AgentPreviewTraceDelete.run(['--no-prompt']);
      expect(yesNoOrCancelStub.called).to.be.false;
    });
  });

  describe('--api-name filter', () => {
    it('deletes only traces for the matching agent', async () => {
      const result = await AgentPreviewTraceDelete.run(['--api-name', 'My_Agent_A', '--no-prompt']);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.agent === 'My_Agent_A')).to.be.true;
      expect(unlinkStub.callCount).to.equal(2);
    });

    it('uses case-insensitive substring match', async () => {
      const result = await AgentPreviewTraceDelete.run(['--api-name', 'agent_a', '--no-prompt']);
      expect(result).to.have.length(2);
    });

    it('returns empty when no agents match', async () => {
      const result = await AgentPreviewTraceDelete.run(['--api-name', 'NonExistent', '--no-prompt']);
      expect(result).to.deep.equal([]);
      expect(unlinkStub.called).to.be.false;
    });
  });

  describe('--authoring-bundle filter', () => {
    it('deletes only traces for the matching bundle', async () => {
      const result = await AgentPreviewTraceDelete.run(['--authoring-bundle', 'My_Agent_B', '--no-prompt']);
      expect(result).to.have.length(1);
      expect(result[0].agent).to.equal('My_Agent_B');
    });
  });

  describe('--session-id filter', () => {
    it('deletes only traces for the specified session', async () => {
      const result = await AgentPreviewTraceDelete.run(['--session-id', 'sess-2', '--no-prompt']);
      expect(result).to.have.length(1);
      expect(result[0].sessionId).to.equal('sess-2');
    });

    it('returns empty when session ID does not match', async () => {
      const result = await AgentPreviewTraceDelete.run(['--session-id', 'no-such-session', '--no-prompt']);
      expect(result).to.deep.equal([]);
    });
  });

  describe('--older-than filter', () => {
    it('deletes only traces older than the duration (days)', async () => {
      // OLD_MTIME is ~60 days ago — caught by 30d. RECENT_MTIME is ~23 days ago — not caught.
      const result = await AgentPreviewTraceDelete.run(['--older-than', '30d', '--no-prompt']);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-2'); // OLD, AgentA
      expect(planIds).to.include('plan-3'); // OLD, AgentB
      expect(planIds).to.not.include('plan-1'); // RECENT, not deleted
    });

    it('deletes nothing when all traces are newer than the duration', async () => {
      // Override traces with mtimes in the future so nothing is "older than 1 day"
      const futureMtime = new Date(Date.now() + 86_400_000);
      listSessionTracesStub
        .withArgs('AgentA', 'sess-1')
        .resolves([
          {
            planId: 'plan-1',
            path: '/sfdx/agents/AgentA/sessions/sess-1/traces/plan-1.json',
            size: 1000,
            mtime: futureMtime,
          },
        ]);
      listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves([]);
      const result = await AgentPreviewTraceDelete.run(['--older-than', '1d', '--no-prompt']);
      expect(result).to.deep.equal([]);
    });

    it('accepts hours unit', async () => {
      // OLD_MTIME is weeks old, caught by 1h. RECENT_MTIME is ~23 days old, also caught.
      // Use a very large hours value to catch everything.
      const result = await AgentPreviewTraceDelete.run(['--older-than', '1h', '--no-prompt']);
      expect(result).to.have.length(3);
    });

    it('accepts weeks unit', async () => {
      // OLD_MTIME is ~8-9 weeks ago — caught by 4w. RECENT_MTIME is ~3 weeks ago — not caught.
      const result = await AgentPreviewTraceDelete.run(['--older-than', '4w', '--no-prompt']);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-2');
      expect(planIds).to.include('plan-3');
      expect(planIds).to.not.include('plan-1');
    });

    it('rejects a value without a unit', async () => {
      try {
        await AgentPreviewTraceDelete.run(['--older-than', '7', '--no-prompt']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/invalid.*older-than|InvalidDuration/i);
      }
    });

    it('rejects a non-numeric value', async () => {
      try {
        await AgentPreviewTraceDelete.run(['--older-than', 'lastweek', '--no-prompt']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/invalid.*older-than|InvalidDuration/i);
      }
    });
  });

  describe('combined filters', () => {
    it('applies agent and older-than filters together', async () => {
      // Only plan-2 (AgentA + OLD) — plan-1 is recent, AgentB is excluded by name filter
      const result = await AgentPreviewTraceDelete.run([
        '--api-name',
        'My_Agent_A',
        '--older-than',
        '30d',
        '--no-prompt',
      ]);
      expect(result).to.have.length(1);
      expect(result[0].planId).to.equal('plan-2');
    });

    it('applies session-id and agent filters together', async () => {
      const result = await AgentPreviewTraceDelete.run([
        '--api-name',
        'My_Agent_A',
        '--session-id',
        'sess-1',
        '--no-prompt',
      ]);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.sessionId === 'sess-1')).to.be.true;
    });
  });
});
