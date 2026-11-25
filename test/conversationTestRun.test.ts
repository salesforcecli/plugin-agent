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

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { Lifecycle } from '@salesforce/core';
import type { CltTestSpec, ConversationTestResultsResponse } from '@salesforce/agents';
import { hasExecutionErrors, readConversationSpec, toDisplayResults } from '../src/conversationTestRun.js';

const CLT_YAML = `
name: Order status
testScope: CONVERSATION_LEVEL
subjectName: Order_Agent
maxTurns: 5
testCases:
  - conversationGoal: Check the status of my order
`;

const spec: CltTestSpec = {
  name: 'Order status',
  testScope: 'CONVERSATION_LEVEL',
  subjectName: 'Order_Agent',
  testCases: [{ conversationGoal: 'Check the status of my order' }, { conversationGoal: 'Cancel my order' }],
};

const expectError = async (promise: Promise<unknown>): Promise<any> => {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  expect.fail('expected the call to throw');
};

describe('conversationTestRun', () => {
  let tmpDir: string;
  const writeSpec = (content: string): string => {
    const file = join(tmpDir, 'spec.yaml');
    writeFileSync(file, content, 'utf-8');
    return file;
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'clt-run-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readConversationSpec', () => {
    it('returns a valid conversation-level spec', async () => {
      const result = await readConversationSpec(writeSpec(CLT_YAML));
      expect(result.name).to.equal('Order status');
      expect(result.testCases).to.have.length(1);
    });

    it('throws SpecFileNotFound (exit 2) for a missing file', async () => {
      const err = await expectError(readConversationSpec(join(tmpDir, 'missing.yaml')));
      expect(err.name).to.equal('SpecFileNotFound');
      expect(err.exitCode).to.equal(2);
    });

    it('throws InvalidSpec for YAML that does not parse', async () => {
      const file = writeSpec('name: [unclosed');
      const err = await expectError(readConversationSpec(file));
      expect(err.name).to.equal('InvalidSpecError');
      expect(err.message).to.include(`The spec ${file} isn't valid:`);
    });

    it('throws SpecNotConversationLevel for a turn-level spec', async () => {
      const err = await expectError(readConversationSpec(writeSpec('name: x\nsubjectName: A\ntestCases: []\n')));
      expect(err.name).to.equal('SpecNotConversationLevelError');
      expect(err.actions[0]).to.include('testScope: CONVERSATION_LEVEL');
    });

    it('throws InvalidSpec with the validation message for a spec the ephemeral run rejects', async () => {
      const err = await expectError(readConversationSpec(writeSpec(CLT_YAML.replace('maxTurns: 5', 'maxTurns: 0'))));
      expect(err.name).to.equal('InvalidSpecError');
      expect(err.message).to.include('maxTurns');
      expect(err.message).to.include('whole number of at least 1');
    });

    it('warns, without throwing, for a maxTurns over the limit for a run without saving', async () => {
      const emitWarning = sinon.stub(Lifecycle.getInstance(), 'emitWarning').resolves();
      try {
        const result = await readConversationSpec(writeSpec(CLT_YAML.replace('maxTurns: 5', 'maxTurns: 50')));
        expect(result.maxTurns).to.equal(50);
        expect(emitWarning.calledOnce).to.be.true;
        expect(emitWarning.firstCall.args[0]).to.include('maxTurns').and.include('save the suite');
      } finally {
        emitWarning.restore();
      }
    });
  });

  describe('resolveConversationAgent', () => {
    let resolveAgentStub: sinon.SinonStub;
    let queryStub: sinon.SinonStub;
    let resolveConversationAgent: any;
    const org = (): any => ({ getConnection: () => ({ query: queryStub }) });

    beforeEach(async () => {
      resolveAgentStub = sinon.stub().resolves({ agentId: '0XxA', versionId: '0X9Latest' });
      queryStub = sinon.stub().resolves({ records: [{ Id: '0X9V3' }] });
      ({ resolveConversationAgent } = await esmock('../src/conversationTestRun.js', {
        '@salesforce/agents': { resolveAgent: resolveAgentStub },
      }));
    });

    it('returns undefined for a draft agent (project)', async () => {
      const result = await resolveConversationAgent(org(), {
        ...spec,
        subjectName: undefined,
        project: { projectId: '1bY', projectVersionId: '1bZ' },
      });
      expect(result).to.equal(undefined);
      expect(resolveAgentStub.called).to.be.false;
    });

    it('uses the latest version when subjectVersion is omitted', async () => {
      expect(await resolveConversationAgent(org(), spec)).to.deep.equal({
        agentId: '0XxA',
        agentVersionId: '0X9Latest',
      });
      expect(queryStub.called).to.be.false;
    });

    it('looks up subjectVersion by BotVersion DeveloperName, escaping quotes', async () => {
      const result = await resolveConversationAgent(org(), { ...spec, subjectVersion: "v3'" });
      expect(result).to.deep.equal({ agentId: '0XxA', agentVersionId: '0X9V3' });
      expect(queryStub.firstCall.args[0]).to.equal(
        "SELECT Id FROM BotVersion WHERE BotDefinitionId = '0XxA' AND DeveloperName = 'v3\\''"
      );
    });

    it('throws AgentVersionNotFound (exit 2) for an unknown subjectVersion', async () => {
      queryStub.resolves({ records: [] });
      const err = await expectError(resolveConversationAgent(org(), { ...spec, subjectVersion: 'v9' }));
      expect(err.name).to.equal('AgentVersionNotFound');
      expect(err.exitCode).to.equal(2);
      expect(err.message).to.include("Version 'v9' of agent 'Order_Agent' not found.");
    });

    it('throws AgentNotFound (exit 2) with the lookup message when the agent is unknown', async () => {
      resolveAgentStub.rejects(new Error("Agent 'Order_Agent' not found."));
      const err = await expectError(resolveConversationAgent(org(), spec));
      expect(err.name).to.equal('AgentNotFound');
      expect(err.exitCode).to.equal(2);
      expect(err.message).to.equal("Agent 'Order_Agent' not found.");
    });
  });

  describe('toDisplayResults', () => {
    it('adds each case goal as an input and fills missing JSON strings', () => {
      const results: ConversationTestResultsResponse = {
        status: 'Completed',
        testCases: [
          {
            testNumber: 2,
            subjectResponse: '{}',
            testScorerResults: [{ scorerName: 'task_resolution', scorerResponse: '{"status":"PASS"}' }],
          },
          { testNumber: 1, testScorerResults: [{ scorerName: 'task_resolution' }] },
          { testNumber: 9 },
        ],
      };
      const display = toDisplayResults(spec, results);
      expect(display.status).to.equal('Completed');
      expect(display.testCases[0]).to.deep.equal({
        testNumber: 2,
        subjectResponse: '{}',
        testScorerResults: [{ scorerName: 'task_resolution', scorerResponse: '{"status":"PASS"}' }],
        inputs: [{ name: 'Conversation Goal', value: 'Cancel my order' }],
      });
      expect(display.testCases[1].subjectResponse).to.equal('');
      expect(display.testCases[1].testScorerResults[0].scorerResponse).to.equal('');
      expect(display.testCases[2].testScorerResults).to.deep.equal([]);
      expect((display.testCases[2] as any).inputs[0].value).to.equal(undefined);
    });

    it('flattens scorer outcomes nested under content and keeps unparseable responses as sent', () => {
      const results: ConversationTestResultsResponse = {
        status: 'Completed',
        testCases: [
          {
            testNumber: 1,
            testScorerResults: [
              {
                scorerName: 'task_resolution',
                scorerResponse: '{"content":{"status":"PASS","score":5.0,"reasoning":"Resolved."},"schema":{}}',
              },
              { scorerName: 'acceptance_criteria', scorerResponse: 'not json' },
            ],
          },
        ],
      };
      const [scorer, unparsed] = toDisplayResults(spec, results).testCases[0].testScorerResults;
      expect(JSON.parse(scorer.scorerResponse)).to.deep.equal({ status: 'PASS', score: 5, reasoning: 'Resolved.' });
      expect(unparsed.scorerResponse).to.equal('not json');
    });
  });

  describe('hasExecutionErrors', () => {
    const run = (status: string, scorerResponse?: string): ConversationTestResultsResponse => ({
      status,
      testCases: [
        { testNumber: 1, testScorerResults: [{ scorerName: 'task_resolution', scorerResponse }] },
        { testNumber: 2 },
      ],
    });

    it('is false for a completed run with PASS and FAIL scores', () => {
      expect(hasExecutionErrors(run('Completed', '{"status":"FAIL"}'))).to.be.false;
      expect(hasExecutionErrors(run('Completed'))).to.be.false;
    });

    it('is true when the run status is Failed', () => {
      expect(hasExecutionErrors(run('Failed', '{"status":"PASS"}'))).to.be.true;
    });

    it('is true when a scorer returned ERROR, in either response shape', () => {
      expect(hasExecutionErrors(run('Completed', '{"status":"error"}'))).to.be.true;
      expect(hasExecutionErrors(run('Completed', '{"content":{"status":"ERROR"}}'))).to.be.true;
    });
  });
});
