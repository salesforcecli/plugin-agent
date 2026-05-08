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
import type { AgentTraceReadResult } from '../../src/commands/agent/trace/read.js';
import { getTestSession, getUsername } from './shared-setup.js';

describe('agent trace read', function () {
  this.timeout(30 * 60 * 1000);

  let session: TestSession;
  let sessionId: string;
  const bundleApiName = 'Willie_Resort_Manager';

  before(async function () {
    this.timeout(30 * 60 * 1000);
    session = await getTestSession();

    // Start a preview session with two turns so there are traces to read
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

    execCmd<AgentPreviewSendResult>(
      `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "Tell me more" --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    );

    execCmd<AgentPreviewEndResult>(
      `agent preview end --session-id ${sessionId} --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    );
  });

  describe('--format summary (default)', () => {
    it('returns a summary result for the session', () => {
      const result = execCmd<AgentTraceReadResult>(`agent trace read --session-id ${sessionId} --json`, {
        ensureExitCode: 0,
        cwd: session.project.dir,
      }).jsonOutput?.result;
      expect(result?.format).to.equal('summary');
      expect(result?.sessionId).to.equal(sessionId);
      expect(result?.turns).to.be.an('array').with.length.greaterThan(0);
    });

    it('each turn has the required summary fields', () => {
      const result = execCmd<AgentTraceReadResult>(`agent trace read --session-id ${sessionId} --json`, {
        ensureExitCode: 0,
        cwd: session.project.dir,
      }).jsonOutput?.result;
      const turn = result!.turns![0];
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
      expect(turn.userInput).to.be.a('string').and.have.length.greaterThan(0);
      expect(turn.agentResponse).to.be.a('string').and.have.length.greaterThan(0);
      expect(turn.topic).to.be.a('string').and.have.length.greaterThan(0);
    });

    it('scopes to a single turn with --turn 1', () => {
      const result = execCmd<AgentTraceReadResult>(`agent trace read --session-id ${sessionId} --turn 1 --json`, {
        ensureExitCode: 0,
        cwd: session.project.dir,
      }).jsonOutput?.result;
      expect(result?.turns).to.have.length(1);
      expect(result?.turns![0].turn).to.equal(1);
    });
  });

  describe('--format detail', () => {
    it('errors when --dimension is missing', () => {
      execCmd(`agent trace read --session-id ${sessionId} --format detail --json`, {
        ensureExitCode: 1,
        cwd: session.project.dir,
      });
    });

    it('returns routing dimension rows', () => {
      const result = execCmd<AgentTraceReadResult>(
        `agent trace read --session-id ${sessionId} --format detail --dimension routing --json`,
        { ensureExitCode: 0, cwd: session.project.dir }
      ).jsonOutput?.result;
      expect(result?.format).to.equal('detail');
      expect(result?.dimension).to.equal('routing');
      expect(result?.detail).to.be.an('array').with.length.greaterThan(0);
      const row = result!.detail![0] as { turn: number; intent: string; toTopic: string };
      expect(row.turn).to.be.a('number');
      expect(row.intent).to.be.a('string');
      expect(row.toTopic).to.be.a('string');
    });

    it('returns grounding dimension rows', () => {
      const result = execCmd<AgentTraceReadResult>(
        `agent trace read --session-id ${sessionId} --format detail --dimension grounding --json`,
        { ensureExitCode: 0, cwd: session.project.dir }
      ).jsonOutput?.result;
      expect(result?.detail).to.be.an('array').with.length.greaterThan(0);
      const row = result!.detail![0] as { prompt: string; latencyMs: number };
      expect(row.prompt).to.be.a('string').and.include('React');
      expect(row.latencyMs).to.be.a('number').and.greaterThanOrEqual(0);
    });

    it('returns actions dimension rows (may be empty for off-topic sessions)', () => {
      const result = execCmd<AgentTraceReadResult>(
        `agent trace read --session-id ${sessionId} --format detail --dimension actions --json`,
        { ensureExitCode: 0, cwd: session.project.dir }
      ).jsonOutput?.result;
      expect(result?.format).to.equal('detail');
      expect(result?.detail).to.be.an('array');
    });

    it('returns errors dimension rows (may be empty for successful sessions)', () => {
      const result = execCmd<AgentTraceReadResult>(
        `agent trace read --session-id ${sessionId} --format detail --dimension errors --json`,
        { ensureExitCode: 0, cwd: session.project.dir }
      ).jsonOutput?.result;
      expect(result?.format).to.equal('detail');
      expect(result?.detail).to.be.an('array');
    });
  });

  describe('--format raw', () => {
    it('returns raw trace JSON', () => {
      const result = execCmd<AgentTraceReadResult>(`agent trace read --session-id ${sessionId} --format raw --json`, {
        ensureExitCode: 0,
        cwd: session.project.dir,
      }).jsonOutput?.result;
      expect(result?.format).to.equal('raw');
      expect(result?.raw).to.be.an('array').with.length.greaterThan(0);
      const trace = result!.raw![0] as { type: string; plan: unknown[] };
      expect(trace.type).to.equal('PlanSuccessResponse');
      expect(trace.plan).to.be.an('array').with.length.greaterThan(0);
    });
  });

  describe('error handling', () => {
    it('errors when session is not found', () => {
      execCmd('agent trace read --session-id no-such-session --json', {
        ensureExitCode: 1,
        cwd: session.project.dir,
      });
    });
  });
});
