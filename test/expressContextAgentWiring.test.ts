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

import { expect } from 'chai';
import {
  addRetrieverAction,
  hasAction,
  libraryNameForSubagent,
  listSubagents,
  type RetrieverActionInput,
} from '../src/expressContextAgentWiring.js';

const SCRIPT = [
  'config:',
  '    developer_name: "My_Agent"',
  '',
  'start_agent agent_router:',
  '    label: "Agent Router"',
  '    reasoning:',
  '        actions:',
  '            go_to_faq: @utils.transition to @subagent.general_faq',
  '',
  'subagent general_faq:',
  '    label: "General FAQ"',
  '    description: "Answers general questions"',
  '',
  '    reasoning:',
  '        instructions: ->',
  '            | Answer questions.',
  '        actions:',
  '            escalate_to_human: @utils.escalate',
  '                description: "Escalate."',
  '',
  '    actions:',
  '        Existing_Action:',
  '            description: "Existing"',
  '            target: "flow://Existing"',
  '',
  'subagent no_label_bare:',
  '    description: "No label, no reasoning, no actions"',
  '',
  'subagent reasoning_only:',
  '    label: "Reasoning \\"Only\\""',
  '    reasoning:',
  '        instructions: ->',
  '            | Do things.',
].join('\n');

const INPUT: RetrieverActionInput = {
  subagent: 'general_faq',
  actionName: 'General_FAQ_Express_RetrieverAction',
  label: 'Acura Management Action',
  description: 'Answers "Acura" questions',
  retrieverApiName: 'General_FAQ_Express_Retriever_1Cx_ABC',
};

/** Lines of the given top-level subagent block in `script`. */
const blockOf = (script: string, name: string): string[] => {
  const lines = script.split('\n');
  const start = lines.indexOf(`subagent ${name}:`);
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === '' || lines[end].startsWith(' '))) end++;
  return lines.slice(start, end);
};

describe('expressContextAgentWiring', () => {
  describe('listSubagents', () => {
    it('returns subagents in order with display labels, excluding start_agent', () => {
      expect(listSubagents(SCRIPT)).to.deep.equal([
        { name: 'general_faq', label: 'General FAQ' },
        { name: 'no_label_bare', label: 'no_label_bare' },
        { name: 'reasoning_only', label: 'Reasoning "Only"' },
      ]);
    });

    it('returns an empty list when there are no subagents', () => {
      expect(listSubagents('config:\n    developer_name: "X"\n')).to.deep.equal([]);
    });

    it('handles CRLF line endings', () => {
      expect(listSubagents(SCRIPT.replace(/\n/g, '\r\n')).map((s) => s.name)).to.have.length(3);
    });
  });

  describe('hasAction', () => {
    it('detects an action defined in the subagent actions block', () => {
      expect(hasAction(SCRIPT, 'general_faq', 'Existing_Action')).to.be.true;
    });

    it('ignores reasoning-level actions and nested keys', () => {
      expect(hasAction(SCRIPT, 'general_faq', 'escalate_to_human')).to.be.false;
      expect(hasAction(SCRIPT, 'general_faq', 'description')).to.be.false;
    });

    it('is false for a missing subagent or a subagent without actions', () => {
      expect(hasAction(SCRIPT, 'nope', 'Existing_Action')).to.be.false;
      expect(hasAction(SCRIPT, 'no_label_bare', 'Existing_Action')).to.be.false;
    });
  });

  describe('libraryNameForSubagent', () => {
    it('appends Express to the display name and derives an API name', () => {
      expect(libraryNameForSubagent('General FAQ')).to.deep.equal({
        masterLabel: 'General FAQ Express',
        developerName: 'General_FAQ_Express',
      });
    });

    it('collapses punctuation and trims underscores', () => {
      expect(libraryNameForSubagent('  Acura (2025) — RDX!  ').developerName).to.equal('Acura_2025_RDX_Express');
    });

    it('prefixes names that do not start with a letter', () => {
      expect(libraryNameForSubagent('2025 Models').developerName).to.equal('X_2025_Models_Express');
    });

    it('caps the API name at 80 characters without a trailing underscore', () => {
      const { developerName } = libraryNameForSubagent(`${'a'.repeat(79)} b`);
      expect(developerName.length).to.be.at.most(80);
      expect(developerName.endsWith('_')).to.be.false;
    });
  });

  describe('addRetrieverAction', () => {
    it('adds the definition in the documented shape and a reasoning reference', () => {
      const block = blockOf(addRetrieverAction(SCRIPT, INPUT), 'general_faq').join('\n');

      expect(block).to.include(
        [
          '        General_FAQ_Express_RetrieverAction:',
          '            description: "Answers \\"Acura\\" questions"',
          '            label: "Acura Management Action"',
          '            source: "General_FAQ_Express_RetrieverAction"',
          '            target: "retriever://General_FAQ_Express_Retriever_1Cx_ABC"',
          '            inputs:',
          '                searchText: string',
          '                    label: "Search Text"',
          '                    description: "A string containing general terms for the search."',
          '                    is_required: True',
          '                resultCount: integer',
        ].join('\n')
      );
      for (const field of [
        'retrievalMode: string',
        'enableCitations: boolean',
        'locale: string',
        'clientName: string',
        'clientTraceId: string',
      ]) {
        expect(block).to.include(`                ${field}\n`);
      }
      expect(block).to.include(
        [
          '            outputs:',
          '                results: string',
          '                    label: "Results"',
          '                    description: "An Apex ConnectApi__MlRetrieverQueryResultRepresentation record that contains the results of the action."',
          '                    is_displayable: False',
          '                    filter_from_agent: False',
        ].join('\n')
      );
      // Reference goes after the existing reasoning action, inside reasoning.actions.
      expect(block).to.include(
        [
          '                description: "Escalate."',
          '            General_FAQ_Express_RetrieverAction: @actions.General_FAQ_Express_RetrieverAction',
          '                with searchText = ...',
        ].join('\n')
      );
      // Definition goes after the existing action definition.
      expect(block.indexOf('Existing_Action:')).to.be.lessThan(
        block.indexOf('\n        General_FAQ_Express_RetrieverAction:\n')
      );
    });

    it('leaves other subagents untouched', () => {
      const out = addRetrieverAction(SCRIPT, INPUT);
      expect(blockOf(out, 'reasoning_only')).to.deep.equal(blockOf(SCRIPT, 'reasoning_only'));
      expect(blockOf(out, 'no_label_bare')).to.deep.equal(blockOf(SCRIPT, 'no_label_bare'));
    });

    it('creates reasoning and actions blocks when a subagent has neither', () => {
      const block = blockOf(addRetrieverAction(SCRIPT, { ...INPUT, subagent: 'no_label_bare' }), 'no_label_bare');
      const text = block.join('\n');
      expect(text).to.include('    actions:\n        General_FAQ_Express_RetrieverAction:');
      expect(text).to.include(
        '    reasoning:\n        actions:\n            General_FAQ_Express_RetrieverAction: @actions.General_FAQ_Express_RetrieverAction'
      );
    });

    it('adds reasoning.actions and a subagent actions block when only instructions exist', () => {
      const text = blockOf(addRetrieverAction(SCRIPT, { ...INPUT, subagent: 'reasoning_only' }), 'reasoning_only').join(
        '\n'
      );
      expect(text).to.include(
        '            | Do things.\n        actions:\n            General_FAQ_Express_RetrieverAction: @actions.'
      );
      expect(text).to.include('\n\n    actions:\n        General_FAQ_Express_RetrieverAction:\n');
      // Reference stays inside reasoning, before the subagent-level actions block.
      expect(text.indexOf('@actions.')).to.be.lessThan(text.indexOf('    actions:\n        General_FAQ'));
    });

    it('preserves CRLF line endings', () => {
      const out = addRetrieverAction(SCRIPT.replace(/\n/g, '\r\n'), INPUT);
      expect(out.split('\r\n').length).to.equal(out.split('\n').length);
    });

    it('matches a two-space indent unit', () => {
      const twoSpace = 'subagent faq:\n  label: "FAQ"\n  reasoning:\n    actions:\n      a: @utils.escalate\n';
      const out = addRetrieverAction(twoSpace, { ...INPUT, subagent: 'faq' });
      expect(out).to.include('\n  actions:\n    General_FAQ_Express_RetrieverAction:\n      description:');
      expect(out).to.include(
        '\n      General_FAQ_Express_RetrieverAction: @actions.General_FAQ_Express_RetrieverAction'
      );
    });

    it('throws for an unknown subagent', () => {
      expect(() => addRetrieverAction(SCRIPT, { ...INPUT, subagent: 'nope' })).to.throw(
        'Subagent "nope" was not found'
      );
    });

    it('throws when the action already exists', () => {
      expect(() => addRetrieverAction(SCRIPT, { ...INPUT, actionName: 'Existing_Action' })).to.throw(
        'already has an action named "Existing_Action"'
      );
    });
  });
});
