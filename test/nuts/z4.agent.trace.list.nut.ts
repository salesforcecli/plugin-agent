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
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import type { AgentPreviewStartResult } from '../../src/commands/agent/preview/start.js';
import type { AgentPreviewSendResult } from '../../src/commands/agent/preview/send.js';
import type { AgentPreviewEndResult } from '../../src/commands/agent/preview/end.js';
import type { AgentTraceListResult } from '../../src/commands/agent/trace/list.js';
import { getTestSession, getUsername } from './shared-setup.js';

describe('agent trace list', function () {
  this.timeout(30 * 60 * 1000);

  let session: TestSession;
  let sessionId: string;
  const bundleApiName = 'Willie_Resort_Manager';

  before(async function () {
    this.timeout(30 * 60 * 1000);
    session = await getTestSession();

    // Start a preview session so there are traces to list
    const targetOrg = getUsername();
    const startResult = execCmd<AgentPreviewStartResult>(
      `agent preview start --authoring-bundle ${bundleApiName} --simulate-actions --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    ).jsonOutput?.result;
    expect(startResult?.sessionId).to.be.a('string');
    sessionId = startResult!.sessionId;

    execCmd<AgentPreviewSendResult>(
      `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "What can you help me with?" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    );

    execCmd<AgentPreviewEndResult>(
      `agent preview end --session-id ${sessionId} --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    );
  });

  it('lists traces for all agents and sessions', () => {
    const result = execCmd<AgentTraceListResult>('agent trace list --json', {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.be.an('array').with.length.greaterThan(0);
  });

  it('each trace entry has required fields', () => {
    const result = execCmd<AgentTraceListResult>('agent trace list --json', {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    const entry = result![0];
    expect(entry).to.have.keys(['agent', 'sessionId', 'planId', 'path', 'size', 'mtime']);
    expect(entry.sessionId).to.be.a('string');
    expect(entry.planId).to.be.a('string');
    expect(entry.size).to.be.a('number').and.greaterThan(0);
  });

  it('filters by --session-id', () => {
    const result = execCmd<AgentTraceListResult>(`agent trace list --session-id ${sessionId} --json`, {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.be.an('array').with.length.greaterThan(0);
    expect(result!.every((r) => r.sessionId === sessionId)).to.be.true;
  });

  it('filters by --agent using substring match', () => {
    const result = execCmd<AgentTraceListResult>(`agent trace list --agent ${bundleApiName} --json`, {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.be.an('array').with.length.greaterThan(0);
  });

  it('returns empty array for a non-existent session', () => {
    const result = execCmd<AgentTraceListResult>('agent trace list --session-id no-such-session --json', {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.deep.equal([]);
  });

  it('filters by --since excluding traces before the cutoff', () => {
    const future = '2099-01-01';
    const result = execCmd<AgentTraceListResult>(`agent trace list --since ${future} --json`, {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.deep.equal([]);
  });

  it('rejects an invalid --since value', () => {
    execCmd('agent trace list --since not-a-date --json', {
      ensureExitCode: 'nonZero',
      cwd: session.project.dir,
    });
  });
});
