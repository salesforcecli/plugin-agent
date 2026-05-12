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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, camelcase */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const EVAL_PAYLOAD = JSON.stringify({
  tests: [
    {
      id: 'test-topic-routing',
      steps: [
        { type: 'agent.create_session', id: 'session' },
        {
          type: 'agent.send_message',
          id: 'msg1',
          session_id: '{session.session_id}',
          utterance: 'What is the weather?',
        },
        { type: 'agent.get_state', id: 'state1', session_id: '{session.session_id}' },
        {
          type: 'evaluator.planner_topic_assertion',
          id: 'check-topic',
          actual: '{state1.response.planner_response.lastExecution.topic}',
          expected: 'Weather_and_Temperature_Information',
          operator: 'equals',
        },
      ],
    },
  ],
});

const YAML_SPEC = `
name: Weather_Test
description: Test weather agent
subjectType: AGENT
subjectName: Local_Info_Agent
testCases:
  - utterance: 'What is the weather?'
    expectedTopic: Weather_and_Temperature_Information
    expectedActions: []
    expectedOutcome: 'The agent should provide weather information'
`;

const MOCK_API_RESULTS = [
  {
    id: 'test-topic-routing',
    evaluation_results: [{ id: 'check-topic', is_pass: true }],
    errors: [],
    outputs: [],
  },
];

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('agent test run-eval', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let tmpDir: string;

  // Stubs for @salesforce/agents exports
  let isYamlTestSpecStub: sinon.SinonStub;
  let parseTestSpecStub: sinon.SinonStub;
  let translateTestSpecStub: sinon.SinonStub;
  let normalizePayloadStub: sinon.SinonStub;
  let splitIntoBatchesStub: sinon.SinonStub;
  let resolveAgentStub: sinon.SinonStub;
  let executeBatchesStub: sinon.SinonStub;
  let buildResultSummaryStub: sinon.SinonStub;
  let formatResultsStub: sinon.SinonStub;

  let AgentTestRunEval: any;

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);

    tmpDir = mkdtempSync(join(tmpdir(), 'run-eval-test-'));

    // Default stub implementations
    isYamlTestSpecStub = $$.SANDBOX.stub().returns(false);
    parseTestSpecStub = $$.SANDBOX.stub().returns({
      name: 'Weather_Test',
      subjectName: 'Local_Info_Agent',
      testCases: [{ utterance: 'What is the weather?' }],
    });
    translateTestSpecStub = $$.SANDBOX.stub().returns(JSON.parse(EVAL_PAYLOAD));
    normalizePayloadStub = $$.SANDBOX.stub().callsFake((p: unknown) => p);
    splitIntoBatchesStub = $$.SANDBOX.stub().callsFake((tests: unknown[]) => [tests]);
    resolveAgentStub = $$.SANDBOX.stub().resolves({ agentId: 'bot-001', versionId: 'ver-001' });
    executeBatchesStub = $$.SANDBOX.stub().resolves(MOCK_API_RESULTS);
    buildResultSummaryStub = $$.SANDBOX.stub().returns({
      summary: { passed: 1, failed: 0, scored: 0, errors: 0 },
      testSummaries: [{ id: 'test-topic-routing', status: 'passed', evaluations: [], outputs: [] }],
    });
    formatResultsStub = $$.SANDBOX.stub().returns('# Agent Evaluation Results');

    const mod = await esmock('../../../../src/commands/agent/test/run-eval.js', {
      '@salesforce/agents': {
        isYamlTestSpec: isYamlTestSpecStub,
        parseTestSpec: parseTestSpecStub,
        translateTestSpec: translateTestSpecStub,
        normalizePayload: normalizePayloadStub,
        splitIntoBatches: splitIntoBatchesStub,
        resolveAgent: resolveAgentStub,
        executeBatches: executeBatchesStub,
        buildResultSummary: buildResultSummaryStub,
        formatResults: formatResultsStub,
      },
    });

    AgentTestRunEval = mod.default;
  });

  afterEach(() => {
    $$.restore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── State ─────────────────────────────────────────────────────────────────

  describe('command metadata', () => {
    it('is in beta state', () => {
      expect(AgentTestRunEval.state).to.equal('beta');
    });
  });

  // ─── JSON payload path ─────────────────────────────────────────────────────

  describe('JSON payload', () => {
    it('runs with an inline JSON string', async () => {
      const result = await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--target-org', testOrg.username]);

      expect(result.summary.passed).to.equal(1);
      expect(result.tests).to.have.length(1);
      expect(result.tests[0].status).to.equal('passed');
    });

    it('reads the spec from a file when the string is not valid JSON', async () => {
      const specFile = join(tmpDir, 'payload.json');
      writeFileSync(specFile, EVAL_PAYLOAD, 'utf-8');

      const result = await AgentTestRunEval.run(['--spec', specFile, '--target-org', testOrg.username]);

      expect(result.summary.passed).to.equal(1);
    });

    it('throws SpecFileNotFound (exit 2) when the file does not exist', async () => {
      try {
        await AgentTestRunEval.run(['--spec', '/nonexistent/path.json', '--target-org', testOrg.username]);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.exitCode).to.equal(2);
        expect(err.name).to.equal('SpecFileNotFound');
      }
    });

    it('calls normalizePayload by default', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--target-org', testOrg.username]);

      expect(normalizePayloadStub.calledOnce).to.be.true;
    });

    it('skips normalizePayload when --no-normalize is set', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--no-normalize', '--target-org', testOrg.username]);

      expect(normalizePayloadStub.called).to.be.false;
    });

    it('resolves agent IDs when --api-name is provided', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--api-name', 'My_Agent', '--target-org', testOrg.username]);

      expect(resolveAgentStub.calledOnceWith(sinon.match.any, 'My_Agent')).to.be.true;
    });

    it('throws AgentNotFound (exit 2) when resolveAgent fails', async () => {
      resolveAgentStub.rejects(new Error('not found'));

      try {
        await AgentTestRunEval.run([
          '--spec',
          EVAL_PAYLOAD,
          '--api-name',
          'Missing_Agent',
          '--target-org',
          testOrg.username,
        ]);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.exitCode).to.equal(2);
        expect(err.name).to.equal('AgentNotFound');
      }
    });

    it('throws TestExecutionFailed (exit 4) when executeBatches fails', async () => {
      executeBatchesStub.rejects(new Error('API down'));

      try {
        await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--target-org', testOrg.username]);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.exitCode).to.equal(4);
        expect(err.name).to.equal('TestExecutionFailed');
      }
    });
  });

  // ─── YAML spec path ────────────────────────────────────────────────────────

  describe('YAML spec', () => {
    beforeEach(() => {
      isYamlTestSpecStub.returns(true);
    });

    it('runs with an inline YAML string', async () => {
      const result = await AgentTestRunEval.run(['--spec', YAML_SPEC, '--target-org', testOrg.username]);

      expect(parseTestSpecStub.calledOnce).to.be.true;
      expect(translateTestSpecStub.calledOnce).to.be.true;
      expect(result.summary.passed).to.equal(1);
    });

    it('auto-infers api-name from subjectName when --api-name is omitted', async () => {
      await AgentTestRunEval.run(['--spec', YAML_SPEC, '--target-org', testOrg.username]);

      // resolveAgent should be called with the subjectName from the parsed spec
      expect(resolveAgentStub.calledOnceWith(sinon.match.any, 'Local_Info_Agent')).to.be.true;
    });

    it('prefers explicit --api-name over auto-inferred subjectName', async () => {
      await AgentTestRunEval.run([
        '--spec',
        YAML_SPEC,
        '--api-name',
        'Override_Agent',
        '--target-org',
        testOrg.username,
      ]);

      expect(resolveAgentStub.calledOnceWith(sinon.match.any, 'Override_Agent')).to.be.true;
    });

    it('reads YAML spec from a file', async () => {
      const specFile = join(tmpDir, 'spec.yaml');
      writeFileSync(specFile, YAML_SPEC, 'utf-8');

      // isYamlTestSpec returns false for the file path string, true for the file content
      isYamlTestSpecStub.onFirstCall().returns(false).onSecondCall().returns(true);

      const result = await AgentTestRunEval.run(['--spec', specFile, '--target-org', testOrg.username]);

      expect(result.summary.passed).to.equal(1);
    });
  });

  // ─── Batch size ────────────────────────────────────────────────────────────

  describe('batch size', () => {
    it('clamps --batch-size to maximum of 5', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--batch-size', '99', '--target-org', testOrg.username]);

      const batchSize = splitIntoBatchesStub.firstCall.args[1] as number;
      expect(batchSize).to.equal(5);
    });

    it('clamps --batch-size to minimum of 1', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--batch-size', '0', '--target-org', testOrg.username]);

      const batchSize = splitIntoBatchesStub.firstCall.args[1] as number;
      expect(batchSize).to.equal(1);
    });

    it('passes through a valid --batch-size unchanged', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--batch-size', '3', '--target-org', testOrg.username]);

      const batchSize = splitIntoBatchesStub.firstCall.args[1] as number;
      expect(batchSize).to.equal(3);
    });
  });

  // ─── Result format ─────────────────────────────────────────────────────────

  describe('result format', () => {
    it('defaults to human format', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--target-org', testOrg.username]);

      expect(formatResultsStub.calledOnceWith(sinon.match.any, 'human')).to.be.true;
    });

    it('passes --result-format tap to formatResults', async () => {
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--result-format', 'tap', '--target-org', testOrg.username]);

      expect(formatResultsStub.calledOnceWith(sinon.match.any, 'tap')).to.be.true;
    });

    it('passes --result-format junit to formatResults', async () => {
      await AgentTestRunEval.run([
        '--spec',
        EVAL_PAYLOAD,
        '--result-format',
        'junit',
        '--target-org',
        testOrg.username,
      ]);

      expect(formatResultsStub.calledOnceWith(sinon.match.any, 'junit')).to.be.true;
    });
  });

  // ─── Exit code behaviour ───────────────────────────────────────────────────

  describe('exit code', () => {
    it('sets process.exitCode to 1 when summary contains errors', async () => {
      buildResultSummaryStub.returns({
        summary: { passed: 0, failed: 0, scored: 0, errors: 2 },
        testSummaries: [{ id: 'test-1', status: 'failed', evaluations: [], outputs: [] }],
      });

      const originalExitCode = process.exitCode;
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--target-org', testOrg.username]);

      expect(process.exitCode).to.equal(1);
      process.exitCode = originalExitCode;
    });

    it('does not set process.exitCode when there are no errors', async () => {
      process.exitCode = undefined;
      await AgentTestRunEval.run(['--spec', EVAL_PAYLOAD, '--target-org', testOrg.username]);

      expect(process.exitCode).to.be.undefined;
    });
  });
});
