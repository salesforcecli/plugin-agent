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

/* eslint-disable camelcase */

import { expect } from 'chai';
import {
  normalizePayload,
  autoCorrectFields,
  normalizeCamelCase,
  normalizeEvaluatorFields,
  convertShorthandRefs,
  injectDefaults,
  stripUnrecognizedFields,
  splitIntoBatches,
  type EvalStep,
  type EvalPayload,
} from '../src/evalNormalizer.js';

describe('evalNormalizer', () => {
  describe('autoCorrectFields', () => {
    it('should correct camelCase agent fields to snake_case', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', agentId: 'abc', agentVersionId: 'v1' }];
      const result = autoCorrectFields(steps);
      expect(result[0]).to.have.property('agent_id', 'abc');
      expect(result[0]).to.have.property('agent_version_id', 'v1');
      expect(result[0]).to.not.have.property('agentId');
      expect(result[0]).to.not.have.property('agentVersionId');
    });

    it('should correct common utterance aliases', () => {
      const steps: EvalStep[] = [{ type: 'agent.send_message', id: 's1', text: 'hello' }];
      const result = autoCorrectFields(steps);
      expect(result[0]).to.have.property('utterance', 'hello');
      expect(result[0]).to.not.have.property('text');
    });

    it('should correct evaluator field aliases', () => {
      const steps: EvalStep[] = [
        { type: 'evaluator.string_assertion', id: 'e1', subject: 'test', expectedValue: 'expected' },
      ];
      const result = autoCorrectFields(steps);
      expect(result[0]).to.have.property('actual', 'test');
      expect(result[0]).to.have.property('expected', 'expected');
    });

    it('should not overwrite existing correct fields', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', agentId: 'wrong', agent_id: 'correct' }];
      const result = autoCorrectFields(steps);
      expect(result[0]).to.have.property('agent_id', 'correct');
    });
  });

  describe('normalizeCamelCase', () => {
    it('should convert useAgentApi to use_agent_api', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', useAgentApi: true }];
      const result = normalizeCamelCase(steps);
      expect(result[0]).to.have.property('use_agent_api', true);
      expect(result[0]).to.not.have.property('useAgentApi');
    });

    it('should convert planner aliases to planner_id', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', plannerDefinitionId: 'p1' }];
      const result = normalizeCamelCase(steps);
      expect(result[0]).to.have.property('planner_id', 'p1');
    });

    it('should only apply to agent.create_session', () => {
      const steps: EvalStep[] = [{ type: 'agent.send_message', id: 's1', useAgentApi: true }];
      const result = normalizeCamelCase(steps);
      expect(result[0]).to.have.property('useAgentApi', true);
    });
  });

  describe('normalizeEvaluatorFields', () => {
    it('should map actual/expected to generated_output/reference_answer for scoring evaluators', () => {
      const steps: EvalStep[] = [{ type: 'evaluator.text_alignment', id: 'e1', actual: 'test', expected: 'ref' }];
      const result = normalizeEvaluatorFields(steps);
      expect(result[0]).to.have.property('generated_output', 'test');
      expect(result[0]).to.have.property('reference_answer', 'ref');
      expect(result[0]).to.not.have.property('actual');
      expect(result[0]).to.not.have.property('expected');
    });

    it('should auto-inject metric_name for scoring evaluators', () => {
      const steps: EvalStep[] = [
        { type: 'evaluator.text_alignment', id: 'e1', generated_output: 'test', reference_answer: 'ref' },
      ];
      const result = normalizeEvaluatorFields(steps);
      expect(result[0]).to.have.property('metric_name', 'base.cosine_similarity');
    });

    it('should auto-inject metric_name for assertion evaluators', () => {
      const steps: EvalStep[] = [{ type: 'evaluator.string_assertion', id: 'e1', actual: 'test', expected: 'ref' }];
      const result = normalizeEvaluatorFields(steps);
      expect(result[0]).to.have.property('metric_name', 'string_assertion');
    });

    it('should auto-lowercase operator for assertion evaluators', () => {
      const steps: EvalStep[] = [
        { type: 'evaluator.string_assertion', id: 'e1', actual: 'a', expected: 'b', operator: 'EQUALS' },
      ];
      const result = normalizeEvaluatorFields(steps);
      expect(result[0]).to.have.property('operator', 'equals');
    });
  });

  describe('convertShorthandRefs', () => {
    it('should convert {step_id.field} to JSONPath', () => {
      const steps: EvalStep[] = [
        { type: 'agent.create_session', id: 'session' },
        { type: 'agent.send_message', id: 'msg1', session_id: '{session.session_id}', utterance: 'hi' },
        { type: 'evaluator.string_assertion', id: 'e1', actual: '{msg1.response}', expected: 'hello' },
      ];
      const result = convertShorthandRefs(steps);
      expect(result[1]).to.have.property('session_id', '$.outputs[0].session_id');
      expect(result[2]).to.have.property('actual', '$.outputs[1].response');
    });

    it('should normalize response.messages paths to response', () => {
      const steps: EvalStep[] = [
        { type: 'agent.send_message', id: 'msg1' },
        { type: 'evaluator.string_assertion', id: 'e1', actual: '{msg1.response.messages[0].message}' },
      ];
      const result = convertShorthandRefs(steps);
      expect(result[1]).to.have.property('actual', '$.outputs[0].response');
    });

    it('should leave unknown step IDs unchanged', () => {
      const steps: EvalStep[] = [{ type: 'evaluator.string_assertion', id: 'e1', actual: '{unknown.field}' }];
      const result = convertShorthandRefs(steps);
      expect(result[0]).to.have.property('actual', '{unknown.field}');
    });
  });

  describe('injectDefaults', () => {
    it('should inject use_agent_api=true when neither use_agent_api nor planner_id present', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', agent_id: 'abc' }];
      const result = injectDefaults(steps);
      expect(result[0]).to.have.property('use_agent_api', true);
    });

    it('should not inject when use_agent_api already present', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', agent_id: 'abc', use_agent_api: false }];
      const result = injectDefaults(steps);
      expect(result[0]).to.have.property('use_agent_api', false);
    });

    it('should not inject when planner_id present', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', planner_id: 'p1' }];
      const result = injectDefaults(steps);
      expect(result[0]).to.not.have.property('use_agent_api');
    });
  });

  describe('stripUnrecognizedFields', () => {
    it('should strip unrecognized fields from agent.create_session', () => {
      const steps: EvalStep[] = [{ type: 'agent.create_session', id: 's1', agent_id: 'abc', extra_field: 'bad' }];
      const result = stripUnrecognizedFields(steps);
      expect(result[0]).to.not.have.property('extra_field');
      expect(result[0]).to.have.property('agent_id', 'abc');
    });

    it('should strip unrecognized fields from scoring evaluators', () => {
      const steps: EvalStep[] = [
        {
          type: 'evaluator.text_alignment',
          id: 'e1',
          generated_output: 'test',
          reference_answer: 'ref',
          metric_name: 'base.cosine_similarity',
          bad_field: 'bad',
        },
      ];
      const result = stripUnrecognizedFields(steps);
      expect(result[0]).to.not.have.property('bad_field');
      expect(result[0]).to.have.property('generated_output', 'test');
    });

    it('should not strip fields from unknown types', () => {
      const steps: EvalStep[] = [{ type: 'evaluator.future_type', id: 'e1', custom_field: 'keep' }];
      const result = stripUnrecognizedFields(steps);
      expect(result[0]).to.have.property('custom_field', 'keep');
    });
  });

  describe('normalizePayload', () => {
    it('should run all normalization passes end-to-end', () => {
      const payload: EvalPayload = {
        tests: [
          {
            id: 'test1',
            steps: [
              { type: 'agent.create_session', id: 'session', agentId: 'abc', agentVersionId: 'v1' },
              { type: 'agent.send_message', id: 'msg1', sessionId: '{session.session_id}', text: 'hello' },
              {
                type: 'evaluator.string_assertion',
                id: 'check1',
                subject: '{msg1.response}',
                expectedValue: 'hi',
              },
            ],
          },
        ],
      };

      const result = normalizePayload(payload);
      const steps = result.tests[0].steps;

      // agent.create_session: corrected fields, injected use_agent_api
      expect(steps[0]).to.have.property('agent_id', 'abc');
      expect(steps[0]).to.have.property('agent_version_id', 'v1');
      expect(steps[0]).to.not.have.property('agentId');

      // agent.send_message: corrected sessionId->session_id, text->utterance, shorthand expanded
      expect(steps[1]).to.have.property('utterance', 'hello');
      expect(steps[1]).to.have.property('session_id', '$.outputs[0].session_id');

      // evaluator: corrected subject->actual, expectedValue->expected, shorthand expanded
      expect(steps[2]).to.have.property('actual', '$.outputs[1].response');
      expect(steps[2]).to.have.property('expected', 'hi');
      expect(steps[2]).to.have.property('metric_name', 'string_assertion');
    });
  });

  describe('splitIntoBatches', () => {
    it('should split tests into correct batch sizes', () => {
      const tests = [
        { id: 't1', steps: [] },
        { id: 't2', steps: [] },
        { id: 't3', steps: [] },
        { id: 't4', steps: [] },
        { id: 't5', steps: [] },
      ];
      const batches = splitIntoBatches(tests, 2);
      expect(batches).to.have.length(3);
      expect(batches[0]).to.have.length(2);
      expect(batches[1]).to.have.length(2);
      expect(batches[2]).to.have.length(1);
    });

    it('should return a single batch when tests fit', () => {
      const tests = [
        { id: 't1', steps: [] },
        { id: 't2', steps: [] },
      ];
      const batches = splitIntoBatches(tests, 5);
      expect(batches).to.have.length(1);
      expect(batches[0]).to.have.length(2);
    });

    it('should handle empty tests array', () => {
      const batches = splitIntoBatches([], 5);
      expect(batches).to.have.length(0);
    });
  });
});
