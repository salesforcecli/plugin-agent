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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */

import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';

const MOCK_PROJECT_DIR = join(process.cwd(), 'test', 'mock-projects', 'agent-generate-template');

const SESSION_ID = 'sess-abc';
const AGENT_ID = 'AgentA';
const PLAN_ID_1 = 'plan-1';
const PLAN_ID_2 = 'plan-2';

const MOCK_CACHED_SESSIONS = [
  {
    agentId: AGENT_ID,
    displayName: 'My_Agent_A',
    sessions: [{ sessionId: SESSION_ID, timestamp: '2026-04-07T17:00:00.000Z' }],
  },
];

const MOCK_ALL_SESSIONS = MOCK_CACHED_SESSIONS.flatMap(({ agentId, displayName, sessions }) =>
  sessions.map(({ sessionId }) => ({ agentId, displayName, sessionId }))
);

const MOCK_TURN_INDEX = {
  version: '1',
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  created: '2026-04-07T17:00:00.000Z',
  turns: [
    {
      turn: 1,
      timestamp: '2026-04-07T17:00:00.000Z',
      role: 'user',
      summary: 'Hi!',
      summaryTruncated: false,
      multiModal: null,
      traceFile: `traces/${PLAN_ID_1}.json`,
      planId: PLAN_ID_1,
    },
    {
      turn: 2,
      timestamp: '2026-04-07T17:00:01.000Z',
      role: 'user',
      summary: "what's the weather",
      summaryTruncated: false,
      multiModal: null,
      traceFile: `traces/${PLAN_ID_2}.json`,
      planId: PLAN_ID_2,
    },
  ],
};

// Simple off-topic trace (no actions, no errors)
const MOCK_TRACE_1 = {
  type: 'PlanSuccessResponse',
  planId: PLAN_ID_1,
  sessionId: SESSION_ID,
  intent: 'Off_Topic',
  topic: 'Off_Topic',
  plan: [
    { type: 'UserInputStep', message: 'Hi!' },
    {
      type: 'LLMExecutionStep',
      promptName: 'AiCopilot__ReactTopicPrompt',
      promptContent: 'classify...',
      promptResponse: 'Off_Topic',
      executionLatency: 460,
      startExecutionTime: 1000,
      endExecutionTime: 1460,
    },
    {
      type: 'UpdateTopicStep',
      topic: 'Off_Topic',
      description: 'Off topic',
      job: 'redirect',
      instructions: [],
      availableFunctions: [],
    },
    {
      type: 'EventStep',
      eventName: 'topicChangeEvent',
      isError: false,
      payload: { oldTopic: 'null', newTopic: 'Off_Topic' },
    },
    {
      type: 'LLMExecutionStep',
      promptName: 'AiCopilot__ReactInitialPrompt',
      promptContent: 'system...',
      promptResponse: 'Hey there!',
      executionLatency: 1637,
      startExecutionTime: 1461,
      endExecutionTime: 3098,
    },
    {
      type: 'PlannerResponseStep',
      message: 'Hey there! How can I assist you today?',
      responseType: 'Inform',
      isContentSafe: true,
    },
  ],
};

// Weather trace with action + error
const MOCK_TRACE_2 = {
  type: 'PlanSuccessResponse',
  planId: PLAN_ID_2,
  sessionId: SESSION_ID,
  intent: 'Local_Weather',
  topic: 'Local_Weather',
  plan: [
    { type: 'UserInputStep', message: "what's the weather" },
    {
      type: 'LLMExecutionStep',
      promptName: 'AiCopilot__ReactTopicPrompt',
      promptContent: 'classify...',
      promptResponse: 'Local_Weather',
      executionLatency: 572,
      startExecutionTime: 2000,
      endExecutionTime: 2572,
    },
    {
      type: 'UpdateTopicStep',
      topic: 'Local_Weather',
      description: 'Weather',
      job: 'answer weather questions',
      instructions: [],
      availableFunctions: ['Check_Weather'],
    },
    {
      type: 'LLMExecutionStep',
      promptName: 'AiCopilot__ReactInitialPrompt',
      promptContent: 'system...',
      promptResponse:
        '- id: call_xxx\n  function:\n    name: Check_Weather\n    arguments: \'{"dateToCheck":"2025-08-18"}\'',
      executionLatency: 748,
      startExecutionTime: 2600,
      endExecutionTime: 3348,
    },
    {
      type: 'FunctionStep',
      function: {
        name: 'Check_Weather',
        input: { dateToCheck: '2025-08-18' },
        output: {},
        errors: [{ statusCode: 'UNKNOWN_EXCEPTION', message: 'Bad response: 404' }],
      },
      executionLatency: 781,
      startExecutionTime: 3350,
      endExecutionTime: 4131,
    },
    {
      type: 'PlannerResponseStep',
      message: "I'm having trouble accessing the weather.",
      responseType: 'Inform',
      isContentSafe: true,
    },
  ],
};

describe('agent trace read', () => {
  const $$ = new TestContext();
  let listAllAgentSessionsStub: sinon.SinonStub;
  let listSessionTracesStub: sinon.SinonStub;
  let readSessionTraceStub: sinon.SinonStub;
  let readTurnIndexStub: sinon.SinonStub;
  let AgentTraceRead: any;

  beforeEach(async () => {
    listAllAgentSessionsStub = $$.SANDBOX.stub().resolves(MOCK_ALL_SESSIONS);
    listSessionTracesStub = $$.SANDBOX.stub().resolves([]);
    readTurnIndexStub = $$.SANDBOX.stub().resolves(MOCK_TURN_INDEX);
    readSessionTraceStub = $$.SANDBOX.stub();
    readSessionTraceStub.withArgs(AGENT_ID, SESSION_ID, PLAN_ID_1).resolves(MOCK_TRACE_1);
    readSessionTraceStub.withArgs(AGENT_ID, SESSION_ID, PLAN_ID_2).resolves(MOCK_TRACE_2);

    const mod = await esmock('../../../../src/commands/agent/trace/read.js', {
      '../../../../src/agentSessionScanner.js': {
        listAllAgentSessions: listAllAgentSessionsStub,
      },
      '@salesforce/agents': {
        listSessionTraces: listSessionTracesStub,
        readSessionTrace: readSessionTraceStub,
        readTurnIndex: readTurnIndexStub,
      },
    });

    AgentTraceRead = mod.default;

    $$.inProject(true);
    const mockProject = { getPath: () => MOCK_PROJECT_DIR } as unknown as SfProject;
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('--format summary (default)', () => {
    it('returns summary for all turns when no --turn specified', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.format).to.equal('summary');
      expect(result.turns).to.have.length(2);
    });

    it('each turn has required fields', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      const turn = result.turns[0];
      expect(turn).to.have.keys([
        'turn',
        'planId',
        'topic',
        'userInput',
        'agentResponse',
        'actionsExecuted',
        'latencyMs',
        'error',
      ]);
    });

    it('populates topic and userInput from trace', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.turns[0].topic).to.equal('Off_Topic');
      expect(result.turns[0].userInput).to.equal('Hi!');
    });

    it('lists executed actions', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.turns[1].actionsExecuted).to.deep.equal(['Check_Weather']);
    });

    it('captures error from failed function step', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.turns[1].error).to.equal('Bad response: 404');
    });

    it('error is null when no function errors exist', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.turns[0].error).to.be.null;
    });

    it('scopes to a single turn with --turn', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID, '--turn', '1']);
      expect(result.turns).to.have.length(1);
      expect(result.turns![0].turn).to.equal(1);
    });
  });

  describe('--format detail', () => {
    it('throws when --dimension is missing', async () => {
      try {
        await AgentTraceRead.run(['--session-id', SESSION_ID, '--format', 'detail']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('--dimension');
      }
    });

    describe('--dimension actions', () => {
      it('returns only action rows', async () => {
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'actions',
        ]);
        expect(result.format).to.equal('detail');
        expect(result.dimension).to.equal('actions');
        expect(result.detail).to.have.length(1);
        expect(result.detail![0]).to.include({ action: 'Check_Weather' });
      });

      it('includes error details in action row', async () => {
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'actions',
        ]);
        expect(result.detail![0].error).to.equal('Bad response: 404');
      });

      it('returns empty when no actions exist', async () => {
        readSessionTraceStub.withArgs(AGENT_ID, SESSION_ID, PLAN_ID_2).resolves(MOCK_TRACE_1);
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'actions',
        ]);
        expect(result.detail).to.deep.equal([]);
      });
    });

    describe('--dimension routing', () => {
      it('returns routing rows for each turn', async () => {
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'routing',
        ]);
        expect(result.detail).to.have.length(2);
        expect(result.detail![0]).to.include({ fromTopic: 'null', toTopic: 'Off_Topic', intent: 'Off_Topic' });
      });

      it('scopes to a single turn with --turn', async () => {
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'routing',
          '--turn',
          '2',
        ]);
        expect(result.detail).to.have.length(1);
        expect(result.detail![0]).to.include({ intent: 'Local_Weather' });
      });
    });

    describe('--dimension errors', () => {
      it('returns rows only for turns with errors', async () => {
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'errors',
        ]);
        expect(result.detail).to.have.length(1);
        expect(result.detail![0]).to.include({ source: 'Check_Weather', errorCode: 'UNKNOWN_EXCEPTION' });
      });

      it('returns empty when no errors exist', async () => {
        readSessionTraceStub.withArgs(AGENT_ID, SESSION_ID, PLAN_ID_2).resolves(MOCK_TRACE_1);
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'errors',
        ]);
        expect(result.detail).to.deep.equal([]);
      });
    });

    describe('--dimension grounding', () => {
      it('returns LLM execution steps with React prompts', async () => {
        const result = await AgentTraceRead.run([
          '--session-id',
          SESSION_ID,
          '--format',
          'detail',
          '--dimension',
          'grounding',
        ]);
        expect(result.detail!.length).to.be.greaterThan(0);
        for (const row of result.detail!) {
          expect((row as any).prompt).to.include('React');
        }
      });
    });
  });

  describe('--format raw', () => {
    it('returns raw trace objects', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID, '--format', 'raw']);
      expect(result.format).to.equal('raw');
      expect(result.raw).to.have.length(2);
      expect(result.raw![0].planId).to.equal(PLAN_ID_1);
    });

    it('raw output matches the full trace structure', async () => {
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID, '--format', 'raw']);
      expect(result.raw![0]).to.deep.equal(MOCK_TRACE_1);
    });
  });

  describe('validation and error handling', () => {
    it('throws when session is not found', async () => {
      listAllAgentSessionsStub.resolves([]);
      try {
        await AgentTraceRead.run(['--session-id', 'no-such-session']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('no-such-session');
      }
    });

    it('throws when --turn is out of range (no index, no trace files)', async () => {
      readTurnIndexStub.resolves(null);
      try {
        await AgentTraceRead.run(['--session-id', SESSION_ID, '--turn', '1']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/turn 1|not found/i);
      }
    });

    it('throws when --turn number does not exist in the index', async () => {
      try {
        await AgentTraceRead.run(['--session-id', SESSION_ID, '--turn', '99']);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/turn 99|not found/i);
      }
    });

    it('throws when all trace files fail to parse', async () => {
      readSessionTraceStub.resetBehavior();
      readSessionTraceStub.resolves(null);
      try {
        await AgentTraceRead.run(['--session-id', SESSION_ID]);
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.match(/Trace parsing failed|raw/i);
      }
    });

    it('returns empty result when session has no trace files and no turn index', async () => {
      readTurnIndexStub.resolves(null);
      listSessionTracesStub.resolves([]);
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.turns).to.deep.equal([]);
    });

    it('falls back to listSessionTraces when no turn index exists', async () => {
      readTurnIndexStub.resolves(null);
      listSessionTracesStub.resolves([{ planId: PLAN_ID_1, path: '/path/plan-1.json', size: 1000, mtime: new Date() }]);
      const result = await AgentTraceRead.run(['--session-id', SESSION_ID]);
      expect(result.turns).to.have.length(1);
      expect(result.turns![0].topic).to.equal('Off_Topic');
    });
  });
});
