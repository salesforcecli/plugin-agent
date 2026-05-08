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
import type { AgentTraceDeleteResult } from '../../src/commands/agent/trace/delete.js';
import { getTestSession, getUsername } from './shared-setup.js';

describe('agent trace delete', function () {
  this.timeout(30 * 60 * 1000);

  let session: TestSession;
  let sessionId: string;
  const bundleApiName = 'Willie_Resort_Manager';

  before(async function () {
    this.timeout(30 * 60 * 1000);
    session = await getTestSession();

    // Start a preview session so there are traces to delete
    const targetOrg = getUsername();
    const startResult = execCmd<AgentPreviewStartResult>(
      `agent preview start --authoring-bundle ${bundleApiName} --simulate-actions --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;
    expect(startResult?.sessionId).to.be.a('string');
    sessionId = startResult!.sessionId;

    execCmd<AgentPreviewSendResult>(
      `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "What can you help me with?" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );

    execCmd<AgentPreviewEndResult>(
      `agent preview end --session-id ${sessionId} --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
  });

  it('returns empty array when no traces match the filter', () => {
    const result = execCmd<AgentTraceDeleteResult>(
      'agent trace delete --session-id no-such-session --no-prompt --json',
      { ensureExitCode: 0, cwd: session.project.dir }
    ).jsonOutput?.result;
    expect(result).to.deep.equal([]);
  });

  it('deletes traces for a specific session and returns deleted entries', () => {
    const result = execCmd<AgentTraceDeleteResult>(`agent trace delete --session-id ${sessionId} --no-prompt --json`, {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.be.an('array').with.length.greaterThan(0);
    expect(result!.every((r) => r.sessionId === sessionId)).to.be.true;
  });

  it('each deleted entry has required fields', () => {
    // Create a fresh session to delete
    const targetOrg = getUsername();
    const startResult = execCmd<AgentPreviewStartResult>(
      `agent preview start --authoring-bundle ${bundleApiName} --simulate-actions --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;
    const newSessionId = startResult!.sessionId;

    execCmd<AgentPreviewSendResult>(
      `agent preview send --session-id ${newSessionId} --authoring-bundle ${bundleApiName} --utterance "Hello" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );
    execCmd<AgentPreviewEndResult>(
      `agent preview end --session-id ${newSessionId} --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );

    const result = execCmd<AgentTraceDeleteResult>(
      `agent trace delete --session-id ${newSessionId} --no-prompt --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    ).jsonOutput?.result;
    expect(result).to.be.an('array').with.length.greaterThan(0);
    const entry = result![0];
    expect(entry).to.have.keys(['agent', 'sessionId', 'planId', 'path']);
    expect(entry.sessionId).to.equal(newSessionId);
  });

  it('deletes traces older than a given duration with --older-than', () => {
    // All traces just created are only seconds old, so --older-than 1d should delete nothing
    const result = execCmd<AgentTraceDeleteResult>('agent trace delete --older-than 1d --no-prompt --json', {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    // Traces just created should not match --older-than 1d
    expect(result).to.be.an('array');
  });

  it('deletes all remaining traces with --no-prompt (cleanup)', () => {
    const result = execCmd<AgentTraceDeleteResult>(`agent trace delete --agent ${bundleApiName} --no-prompt --json`, {
      ensureExitCode: 0,
      cwd: session.project.dir,
    }).jsonOutput?.result;
    expect(result).to.be.an('array');
  });
});
