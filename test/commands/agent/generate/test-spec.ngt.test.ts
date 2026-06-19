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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */

import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import type { NgtTestCase } from '@salesforce/agents';

type ConfirmCfg = { message: string; default?: boolean };
type InputCfg = { message: string };
type CheckboxCfg<T> = { message: string; choices: Array<{ name: string; value: T }> };
type SelectCfg<T> = { message: string; choices: Array<{ name: string; value: T }> };

/**
 * Build a deterministic prompt-stub harness. Each prompt looks up its scripted
 * answer by message-substring; an unmatched message falls through to the
 * supplied default so the tests fail loudly if a flow asks something we
 * weren't expecting.
 */
function harness(answers: {
  confirms?: Record<string, boolean>;
  inputs?: Record<string, string>;
  checkbox?: Record<string, unknown[]>;
  select?: Record<string, unknown>;
  warns?: string[];
}) {
  const confirms = answers.confirms ?? {};
  const inputs = answers.inputs ?? {};
  const checkboxAnswers = answers.checkbox ?? {};
  const selectAnswers = answers.select ?? {};
  const warns = answers.warns ?? [];

  const matchKey = <K extends string>(message: string, table: Record<K, unknown>): K | undefined =>
    (Object.keys(table) as K[]).find((k) => message.includes(k));

  const confirmStub = sinon.stub().callsFake((cfg: ConfirmCfg) => {
    const k = matchKey(cfg.message, confirms);
    if (k === undefined) return Promise.resolve(cfg.default ?? false);
    return Promise.resolve(confirms[k]);
  });

  const inputStub = sinon.stub().callsFake((cfg: InputCfg) => {
    const k = matchKey(cfg.message, inputs);
    if (k === undefined) throw new Error(`Unexpected input prompt: ${cfg.message}`);
    return Promise.resolve(inputs[k]);
  });

  const checkboxStub = sinon.stub().callsFake((cfg: CheckboxCfg<unknown>) => {
    const k = matchKey(cfg.message, checkboxAnswers);
    if (k === undefined) throw new Error(`Unexpected checkbox prompt: ${cfg.message}`);
    return Promise.resolve(checkboxAnswers[k]);
  });

  const selectStub = sinon.stub().callsFake((cfg: SelectCfg<unknown>) => {
    const k = matchKey(cfg.message, selectAnswers);
    if (k === undefined) throw new Error(`Unexpected select prompt: ${cfg.message}`);
    return Promise.resolve(selectAnswers[k]);
  });

  return { confirms, confirmStub, inputStub, checkboxStub, selectStub, warns };
}

async function loadModWithPrompts(harnessHandles: ReturnType<typeof harness>): Promise<any> {
  return esmock('../../../../src/commands/agent/generate/test-spec.js', {
    '@inquirer/prompts': {
      confirm: harnessHandles.confirmStub,
      input: harnessHandles.inputStub,
      checkbox: harnessHandles.checkboxStub,
      select: harnessHandles.selectStub,
    },
  });
}

describe('promptForNgtTestCase (NGT walkthrough)', () => {
  const TOPICS = ['order_status', 'returns', 'identity_verification'];
  const BOTS = ['ReturnsAgent', 'SDRAgent'];
  const SUBJECT = 'ReturnsAgent';

  it('builds a single-input case with assertion + LLM-judged + numeric scorers', async () => {
    const h = harness({
      confirms: {
        'multiple input phrasings': false,
        'context variables': false,
        'Generate boilerplate conversation history': false,
      },
      inputs: { Utterance: 'Where is my order #12345?' },
      checkbox: {
        'Select scorers': ['topic_sequence_match', 'bot_response_rating', 'output_latency_milliseconds'],
      },
      select: {
        // eslint-disable-next-line camelcase
        topic_sequence_match: 'order_status',
      },
      // bot_response_rating expected falls through to inputStub
    });
    h.inputStub.callsFake((cfg: InputCfg) => {
      if (cfg.message.startsWith('Utterance')) return Promise.resolve('Where is my order #12345?');
      if (cfg.message.includes('bot_response_rating')) {
        return Promise.resolve('Agent looks up the order and returns its status');
      }
      throw new Error(`Unexpected input prompt: ${cfg.message}`);
    });

    const mod = await loadModWithPrompts(h);
    const tc: NgtTestCase = await mod.promptForNgtTestCase(TOPICS, BOTS, SUBJECT, 1, () => {});

    expect(tc.inputs).to.have.length(1);
    expect(tc.inputs[0].utterance).to.equal('Where is my order #12345?');
    expect(tc.inputs[0].contextVariables).to.be.undefined;
    expect(tc.inputs[0].conversationHistory).to.be.undefined;

    expect(tc.scorers).to.deep.equal([
      { name: 'topic_sequence_match', expected: 'order_status' },
      { name: 'bot_response_rating', expected: 'Agent looks up the order and returns its status' },
      { name: 'output_latency_milliseconds' },
    ]);
  });

  it('skips the expected prompt entirely for quality scorers (needsExpected=false)', async () => {
    const h = harness({
      confirms: {
        'multiple input phrasings': false,
        'context variables': false,
        'Generate boilerplate conversation history': false,
      },
      inputs: { Utterance: 'Show order details' },
      checkbox: { 'Select scorers': ['factuality', 'completeness'] },
    });

    const mod = await loadModWithPrompts(h);
    const tc: NgtTestCase = await mod.promptForNgtTestCase(TOPICS, BOTS, SUBJECT, 1, () => {});

    expect(tc.scorers).to.deep.equal([{ name: 'factuality' }, { name: 'completeness' }]);
    // No expected prompts were asked.
    const expectedPromptCalls = h.inputStub
      .getCalls()
      .filter((c) => (c.args[0] as InputCfg).message.startsWith('Expected for'));
    expect(expectedPromptCalls).to.have.length(0);
  });

  it('warns when task_resolution is selected without conversationHistory and the user declines boilerplate', async () => {
    const warnCalls: string[] = [];
    const h = harness({
      confirms: {
        'multiple input phrasings': false,
        'context variables': false,
        'Generate boilerplate conversation history': false,
        'task_resolution requires conversationHistory': false,
      },
      inputs: { Utterance: 'Cancel my order' },
      checkbox: { 'Select scorers': ['task_resolution'] },
    });

    const mod = await loadModWithPrompts(h);
    const tc: NgtTestCase = await mod.promptForNgtTestCase(TOPICS, BOTS, SUBJECT, 4, (m: string) => warnCalls.push(m));

    expect(tc.scorers).to.deep.equal([{ name: 'task_resolution' }]);
    expect(tc.inputs[0].conversationHistory).to.be.undefined;
    expect(warnCalls.join('\n')).to.match(/task_resolution|conversationHistory/i);
  });

  it('auto-stamps boilerplate conversationHistory when user accepts the task_resolution rescue prompt', async () => {
    const h = harness({
      confirms: {
        'multiple input phrasings': false,
        'context variables': false,
        'Generate boilerplate conversation history': false,
        'task_resolution requires conversationHistory': true,
      },
      inputs: { Utterance: 'Yes, my email is jane@example.com' },
      checkbox: { 'Select scorers': ['task_resolution'] },
    });

    const mod = await loadModWithPrompts(h);
    const tc: NgtTestCase = await mod.promptForNgtTestCase(TOPICS, BOTS, SUBJECT, 4, () => {});

    expect(tc.inputs[0].conversationHistory).to.have.length(2);
    expect(tc.inputs[0].conversationHistory?.[0]).to.deep.equal({ role: 'user', message: 'example user message' });
    expect(tc.inputs[0].conversationHistory?.[1]).to.deep.equal({
      role: 'agent',
      message: 'example agent message',
      topic: 'Example_agent_topic',
    });
  });

  it('fans out a multi-input case with a shared scorer set', async () => {
    const h = harness({
      confirms: {
        'multiple input phrasings': true,
        'context variables': false,
        'Generate boilerplate conversation history': false,
      },
      checkbox: { 'Select scorers': ['topic_sequence_match', 'action_sequence_match'] },
      // eslint-disable-next-line camelcase
      select: { topic_sequence_match: 'order_status' },
    });

    let utteranceCallCount = 0;
    const utterances = ["What's the status of order #12345?", 'Where is my order 12345', 'Tell me about order #12345'];
    h.inputStub.callsFake((cfg: InputCfg) => {
      if (cfg.message.startsWith('Utterance')) {
        return Promise.resolve(utterances[utteranceCallCount++]);
      }
      if (cfg.message.includes('action_sequence_match')) return Promise.resolve('Get_Order_Status');
      throw new Error(`Unexpected input prompt: ${cfg.message}`);
    });
    // First two "another input utterance" → true, third → false.
    let addAnotherCallCount = 0;
    h.confirmStub.callsFake((cfg: ConfirmCfg) => {
      if (cfg.message.includes('multiple input phrasings')) return Promise.resolve(true);
      if (cfg.message.includes('Add another input utterance')) {
        return Promise.resolve(addAnotherCallCount++ < 2);
      }
      if (cfg.message.includes('context variables')) return Promise.resolve(false);
      if (cfg.message.includes('conversation history')) return Promise.resolve(false);
      return Promise.resolve(false);
    });

    const mod = await loadModWithPrompts(h);
    const tc: NgtTestCase = await mod.promptForNgtTestCase(TOPICS, BOTS, SUBJECT, 7, () => {});

    expect(tc.inputs.map((i) => i.utterance)).to.deep.equal(utterances);
    expect(tc.scorers).to.deep.equal([
      { name: 'topic_sequence_match', expected: 'order_status' },
      { name: 'action_sequence_match', expected: 'Get_Order_Status' },
    ]);
  });

  it('routes agent_handoff_match expected to a select over local Bots minus the subject', async () => {
    const h = harness({
      confirms: {
        'multiple input phrasings': false,
        'context variables': false,
        'Generate boilerplate conversation history': false,
      },
      inputs: { Utterance: 'I need a sales rep' },
      checkbox: { 'Select scorers': ['agent_handoff_match'] },
      // eslint-disable-next-line camelcase
      select: { agent_handoff_match: 'SDRAgent' },
    });

    const mod = await loadModWithPrompts(h);
    const tc: NgtTestCase = await mod.promptForNgtTestCase(TOPICS, BOTS, SUBJECT, 6, () => {});

    expect(tc.scorers).to.deep.equal([{ name: 'agent_handoff_match', expected: 'SDRAgent' }]);

    const handoffSelect = h.selectStub
      .getCalls()
      .find((c) => (c.args[0] as SelectCfg<string>).message.includes('agent_handoff_match'));
    expect(handoffSelect, 'agent_handoff_match should be a select').to.not.be.undefined;
    const choices = (handoffSelect!.args[0] as SelectCfg<string>).choices.map((c) => c.value);
    expect(choices).to.deep.equal(['SDRAgent']);
  });
});
