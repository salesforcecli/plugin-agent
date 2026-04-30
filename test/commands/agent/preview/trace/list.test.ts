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

// RECENT_MTIME: ~23 days ago from 2026-04-30
// OLD_MTIME:    ~60 days ago from 2026-04-30
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

describe('agent preview trace list', () => {
  const $$ = new TestContext();
  let listCachedPreviewSessionsStub: sinon.SinonStub;
  let listSessionTracesStub: sinon.SinonStub;
  let AgentPreviewTraceList: any;

  beforeEach(async () => {
    listCachedPreviewSessionsStub = $$.SANDBOX.stub().resolves(MOCK_CACHED_SESSIONS);
    listSessionTracesStub = $$.SANDBOX.stub();
    listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves(MOCK_TRACES_AGENT_A);
    listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves(MOCK_TRACES_AGENT_B);

    const mod = await esmock('../../../../../src/commands/agent/preview/trace/list.js', {
      '@salesforce/agents': {
        listCachedPreviewSessions: listCachedPreviewSessionsStub,
        listSessionTraces: listSessionTracesStub,
      },
    });

    AgentPreviewTraceList = mod.default;

    $$.inProject(true);
    const mockProject = { getPath: () => MOCK_PROJECT_DIR } as unknown as SfProject;
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('with no filters', () => {
    it('returns all traces across all agents and sessions', async () => {
      const result = await AgentPreviewTraceList.run([]);
      expect(result).to.have.length(3);
    });

    it('includes agent, sessionId, planId, path, size, and mtime fields', async () => {
      const result = await AgentPreviewTraceList.run([]);
      const first = result[0];
      expect(first).to.have.keys(['agent', 'sessionId', 'planId', 'path', 'size', 'mtime']);
    });

    it('uses displayName as the agent field', async () => {
      const result = await AgentPreviewTraceList.run([]);
      const agents = result.map((r: any) => r.agent);
      expect(agents).to.include('My_Agent_A');
      expect(agents).to.include('My_Agent_B');
    });

    it('returns empty when no sessions exist', async () => {
      listCachedPreviewSessionsStub.resolves([]);
      const result = await AgentPreviewTraceList.run([]);
      expect(result).to.deep.equal([]);
    });

    it('returns empty when sessions have no traces', async () => {
      listSessionTracesStub.withArgs('AgentA', 'sess-1').resolves([]);
      listSessionTracesStub.withArgs('AgentB', 'sess-2').resolves([]);
      const result = await AgentPreviewTraceList.run([]);
      expect(result).to.deep.equal([]);
    });
  });

  describe('--api-name filter', () => {
    it('returns only traces for the matching agent', async () => {
      const result = await AgentPreviewTraceList.run(['--api-name', 'My_Agent_A']);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.agent === 'My_Agent_A')).to.be.true;
    });

    it('uses case-insensitive substring match', async () => {
      const result = await AgentPreviewTraceList.run(['--api-name', 'agent_a']);
      expect(result).to.have.length(2);
    });

    it('returns empty when no agents match', async () => {
      const result = await AgentPreviewTraceList.run(['--api-name', 'NonExistent']);
      expect(result).to.deep.equal([]);
    });
  });

  describe('--authoring-bundle filter', () => {
    it('returns only traces for the matching bundle', async () => {
      const result = await AgentPreviewTraceList.run(['--authoring-bundle', 'My_Agent_B']);
      expect(result).to.have.length(1);
      expect(result[0].agent).to.equal('My_Agent_B');
    });
  });

  describe('--session-id filter', () => {
    it('returns only traces for the specified session', async () => {
      const result = await AgentPreviewTraceList.run(['--session-id', 'sess-1']);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.sessionId === 'sess-1')).to.be.true;
    });

    it('returns empty when session ID does not match', async () => {
      const result = await AgentPreviewTraceList.run(['--session-id', 'no-such-session']);
      expect(result).to.deep.equal([]);
    });
  });

  describe('--since filter', () => {
    it('returns only traces at or after the given date (date-only)', async () => {
      // RECENT_MTIME is 2026-04-07, OLD_MTIME is 2026-03-01
      const result = await AgentPreviewTraceList.run(['--since', '2026-04-01']);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-1');
      expect(planIds).to.not.include('plan-2');
      expect(planIds).to.not.include('plan-3');
    });

    it('returns only traces at or after the given datetime', async () => {
      const result = await AgentPreviewTraceList.run(['--since', '2026-04-07T17:00:00.000Z']);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-1'); // exactly equal — mtime >= since
      expect(planIds).to.not.include('plan-2');
    });

    it('returns all traces when since is before all mtimes', async () => {
      const result = await AgentPreviewTraceList.run(['--since', '2026-01-01']);
      expect(result).to.have.length(3);
    });

    it('returns empty when since is after all mtimes', async () => {
      const result = await AgentPreviewTraceList.run(['--since', '2027-01-01']);
      expect(result).to.deep.equal([]);
    });

    it('rejects an invalid date format', async () => {
      try {
        await AgentPreviewTraceList.run(['--since', '43/3']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/invalid.*since|InvalidDate/i);
      }
    });

    it('rejects a plain non-ISO string', async () => {
      try {
        await AgentPreviewTraceList.run(['--since', 'last-week']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/invalid.*since|InvalidDate/i);
      }
    });

    it('accepts millisecond-precision datetime (matching table output format)', async () => {
      const result = await AgentPreviewTraceList.run(['--since', RECENT_MTIME.toISOString()]);
      const planIds = result.map((r: any) => r.planId);
      expect(planIds).to.include('plan-1');
      expect(planIds).to.not.include('plan-2');
    });
  });

  describe('combined filters', () => {
    it('applies agent and since filters together', async () => {
      const result = await AgentPreviewTraceList.run(['--api-name', 'My_Agent_A', '--since', '2026-04-01']);
      expect(result).to.have.length(1);
      expect(result[0].planId).to.equal('plan-1');
    });

    it('applies session-id and api-name filters together', async () => {
      const result = await AgentPreviewTraceList.run(['--api-name', 'My_Agent_A', '--session-id', 'sess-1']);
      expect(result).to.have.length(2);
      expect(result.every((r: any) => r.sessionId === 'sess-1')).to.be.true;
    });
  });
});
