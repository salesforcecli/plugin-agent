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
import { addToSubagent } from '../../../../src/commands/agent/mcp/asset/afscript.js';

// Same layout as an Agent Builder file: subagent at 0, sections at 4, action keys at 8, reasoning refs at 12.
const FILE = [
  'start_agent agent_router:',
  '    label: "Agent Router"',
  '',
  '    actions:',
  '        aexisting:',
  '            source: "aexisting"',
  '            target: "mcpTool://Nc/mcptoolx5fx5fexisting"',
  '',
  '    reasoning:',
  '        instructions: ->',
  '            | Route the user.',
  '        actions:',
  '            go_to_escalation: @utils.transition to @subagent.escalation',
  '            aexisting: @actions.aexisting',
  '',
  'subagent escalation:',
  '    label: "Escalation"',
  '',
  '    reasoning:',
  '        instructions: ->',
  '            | Escalate.',
  '        actions:',
  '            escalate_to_human: @utils.escalate',
  '',
  'subagent bare:',
  '    label: "Bare"',
  '',
].join('\n');

const action = (name: string): { name: string; actionBlock: string; reasoningReference: string } => ({
  name,
  actionBlock: `${name}:\n    source: "${name}"\n    target: "mcpTool://Nc/mcptoolx5fx5f${name}"`,
  reasoningReference: `${name}: @actions.${name}\n    with text = ...`,
});

describe('addToSubagent', () => {
  it('adds the block under actions: and the reference under reasoning: actions: of an existing subagent', () => {
    const r = addToSubagent(FILE, 'agent_router', [action('anew')]);
    const lines = r.content.split('\n');
    expect(r.added).to.deep.equal(['anew']);
    expect(r.skipped).to.deep.equal([]);
    // Block goes after the last action, before the blank line and reasoning:.
    const block = lines.indexOf('        anew:');
    expect(lines.slice(block, block + 3)).to.deep.equal([
      '        anew:',
      '            source: "anew"',
      '            target: "mcpTool://Nc/mcptoolx5fx5fanew"',
    ]);
    expect(block).to.be.lessThan(lines.indexOf('    reasoning:'));
    expect(lines[block - 1]).to.equal('            target: "mcpTool://Nc/mcptoolx5fx5fexisting"');
    // Reference goes after the last reasoning action, with its continuation line at 16.
    const ref = lines.indexOf('            anew: @actions.anew');
    expect(lines[ref - 1]).to.equal('            aexisting: @actions.aexisting');
    expect(lines[ref + 1]).to.equal('                with text = ...');
    expect(ref).to.be.lessThan(lines.indexOf('subagent escalation:'));
  });

  it('skips an action that the subagent already has, so a second run changes nothing', () => {
    const once = addToSubagent(FILE, 'agent_router', [action('anew')]);
    const twice = addToSubagent(once.content, 'agent_router', [action('anew'), action('aexisting')]);
    expect(twice.added).to.deep.equal([]);
    expect(twice.skipped).to.deep.equal(['anew', 'aexisting']);
    expect(twice.content).to.equal(once.content);
  });

  it('creates actions: in a subagent that has only reasoning actions', () => {
    const lines = addToSubagent(FILE, 'escalation', [action('anew')]).content.split('\n');
    const start = lines.indexOf('subagent escalation:');
    const end = lines.indexOf('subagent bare:');
    const section = lines.slice(start, end);
    expect(section).to.include('    actions:');
    expect(section).to.include('        anew:');
    expect(section).to.include('            anew: @actions.anew');
    expect(section.indexOf('            anew: @actions.anew')).to.be.greaterThan(
      section.indexOf('            escalate_to_human: @utils.escalate')
    );
  });

  it('creates actions:, reasoning: and its actions: in a subagent that has neither', () => {
    const lines = addToSubagent(FILE, 'bare', [action('anew')]).content.split('\n');
    const section = lines.slice(lines.indexOf('subagent bare:'));
    expect(section.filter((l) => l.trim())).to.deep.equal([
      'subagent bare:',
      '    label: "Bare"',
      '    actions:',
      '        anew:',
      '            source: "anew"',
      '            target: "mcpTool://Nc/mcptoolx5fx5fanew"',
      '    reasoning:',
      '        actions:',
      '            anew: @actions.anew',
      '                with text = ...',
    ]);
  });

  it('leaves the other subagents unchanged', () => {
    const r = addToSubagent(FILE, 'escalation', [action('anew')]);
    const before = FILE.split('\n');
    const after = r.content.split('\n');
    expect(after.slice(0, before.indexOf('subagent escalation:'))).to.deep.equal(
      before.slice(0, before.indexOf('subagent escalation:'))
    );
    expect(after.slice(after.indexOf('subagent bare:'))).to.deep.equal(before.slice(before.indexOf('subagent bare:')));
  });

  it('fails for an unknown subagent and lists the ones in the file', () => {
    expect(() => addToSubagent(FILE, 'nope', [action('anew')]))
      .to.throw(/nope/)
      .with.property('name', 'SubagentNotFound');
    try {
      addToSubagent(FILE, 'nope', [action('anew')]);
    } catch (e) {
      expect((e as Error).message).to.include('agent_router, escalation, bare');
    }
  });

  it('keeps CRLF line endings', () => {
    const crlf = FILE.split('\n').join('\r\n');
    const r = addToSubagent(crlf, 'agent_router', [action('anew')]);
    expect(r.content.includes('\r\n        anew:\r\n')).to.equal(true);
    expect(r.content.replace(/\r\n/g, '').includes('\n')).to.equal(false);
  });
});
