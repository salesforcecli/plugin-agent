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

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { SfError } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';

const SPEC = {
  name: 'Order status',
  testScope: 'CONVERSATION_LEVEL',
  subjectName: 'Order_Agent',
  testCases: [{ conversationGoal: 'Check the status of my order' }],
};

const RESULTS = {
  status: 'Completed',
  testCases: [
    {
      testNumber: 1,
      subjectResponse: '{}',
      testScorerResults: [{ scorerName: 'task_resolution', scorerResponse: '{"status":"FAIL","reasoning":"no date"}' }],
    },
  ],
};

describe('agent test run --spec', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let tmpDir: string;
  let specFile: string;

  let readConversationSpecStub: sinon.SinonStub;
  let resolveConversationAgentStub: sinon.SinonStub;
  let runEphemeralStub: sinon.SinonStub;
  let handleTestResultsStub: sinon.SinonStub;
  let createTestRunnerStub: sinon.SinonStub;

  let AgentTestRun: any;

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    tmpDir = mkdtempSync(join(tmpdir(), 'clt-run-cmd-'));
    specFile = join(tmpDir, 'spec.yaml');
    writeFileSync(specFile, 'placeholder', 'utf-8');

    readConversationSpecStub = $$.SANDBOX.stub().resolves(SPEC);
    resolveConversationAgentStub = $$.SANDBOX.stub().resolves({ agentId: '0XxA', agentVersionId: '0X9A' });
    runEphemeralStub = $$.SANDBOX.stub().resolves(RESULTS);
    handleTestResultsStub = $$.SANDBOX.stub().resolves();
    createTestRunnerStub = $$.SANDBOX.stub();

    const mod = await esmock('../../../../src/commands/agent/test/run.js', {
      '@salesforce/agents': {
        ConversationTester: class {
          public runEphemeral = runEphemeralStub;
        },
      },
      '../../../../src/conversationTestRun.js': {
        readConversationSpec: readConversationSpecStub,
        resolveConversationAgent: resolveConversationAgentStub,
      },
      '../../../../src/handleTestResults.js': { handleTestResults: handleTestResultsStub },
      '../../../../src/testRunnerFactory.js': { createTestRunner: createTestRunnerStub },
    });
    AgentTestRun = mod.default;
  });

  afterEach(() => {
    $$.restore();
    rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  const run = (...extra: string[]): Promise<any> =>
    AgentTestRun.run(['--spec', specFile, '--target-org', testOrg.username, ...extra]);

  const expectError = async (promise: Promise<unknown>): Promise<any> => {
    try {
      await promise;
    } catch (e) {
      return e;
    }
    expect.fail('expected the command to throw');
  };

  it('runs the spec without saving and returns the results', async () => {
    const result = await run();

    expect(readConversationSpecStub.calledOnceWith(specFile)).to.be.true;
    expect(runEphemeralStub.firstCall.args[0]).to.deep.equal({
      agentId: '0XxA',
      agentVersionId: '0X9A',
      testCases: [{ number: 1, conversationGoal: 'Check the status of my order' }],
    });
    expect(createTestRunnerStub.called).to.be.false;
    expect(result).to.deep.equal({
      ...RESULTS,
      status: 'COMPLETED',
      testScope: 'CONVERSATION_LEVEL',
      runStatus: 'Completed',
    });
  });

  it('passes results, format and output dir to the shared formatter', async () => {
    await run('--result-format', 'junit', '--output-dir', tmpDir);

    const args = handleTestResultsStub.firstCall.args[0];
    expect(args).to.include({ id: 'Order status', format: 'junit', outputDir: tmpDir });
    expect(args.results.testCases[0].inputs).to.deep.equal([
      { name: 'Conversation Goal', value: 'Check the status of my order' },
    ]);
  });

  it('does not set an exit code for scorer FAILs', async () => {
    await run();
    expect(process.exitCode).to.equal(undefined);
  });

  it('sets exit code 1 when the run has execution errors', async () => {
    runEphemeralStub.resolves({ ...RESULTS, status: 'Failed' });
    await run();
    expect(process.exitCode).to.equal(1);
  });

  it('reports a rejected run as ConversationTestRejected (exit 1) with the server message', async () => {
    runEphemeralStub.rejects(
      new SfError('The conversation-level test run was rejected: bad maxTurns', 'ConversationTestRejectedError', [
        'Fix the input the message names, then run again.',
      ])
    );
    const err = await expectError(run());
    expect(err.name).to.equal('ConversationTestRejected');
    expect(err.exitCode).to.equal(1);
    expect(err.message).to.equal('The conversation-level test run was rejected: bad maxTurns');
    expect(err.actions).to.deep.equal(['Fix the input the message names, then run again.']);
  });

  it('reports API failures as TestRunFailed (exit 4)', async () => {
    runEphemeralStub.rejects(new Error('socket hang up'));
    const err = await expectError(run());
    expect(err.name).to.equal('TestRunFailed');
    expect(err.exitCode).to.equal(4);
    expect(err.message).to.equal('Failed to run test: socket hang up');
  });

  it('rejects --spec together with --api-name', async () => {
    const err = await expectError(run('--api-name', 'My_Test'));
    expect(err.message).to.include('--api-name');
    expect(readConversationSpecStub.called).to.be.false;
  });

  it('rejects --spec together with --wait', async () => {
    const err = await expectError(run('--wait', '5'));
    expect(err.message).to.include('--wait');
  });
});
