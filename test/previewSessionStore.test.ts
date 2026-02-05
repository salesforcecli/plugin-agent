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

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { createCache, validatePreviewSession } from '../src/previewSessionStore.js';

function makeMockAgent(baseDir: string, agentId: string) {
  let sessionId: string | undefined;
  const agent = {
    setSessionId(id: string) {
      sessionId = id;
    },
    async getHistoryDir(): Promise<string> {
      if (!sessionId) throw new Error('sessionId not set');
      const dir = join(baseDir, 'agents', agentId, 'sessions', sessionId);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      return dir;
    },
  };
  return agent;
}

describe('previewSessionStore', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = mkdtempSync(join(tmpdir(), 'preview-session-store-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  describe('createCache', () => {
    it('saves session and validates with same agent', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent as never);
      agent.setSessionId('sess-1');
      await validatePreviewSession(agent as never);
    });

    it('allows multiple sessions for same agent', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-a');
      await createCache(agent as never);
      agent.setSessionId('sess-b');
      await createCache(agent as never);
      agent.setSessionId('sess-a');
      await validatePreviewSession(agent as never);
      agent.setSessionId('sess-b');
      await validatePreviewSession(agent as never);
    });
  });

  describe('validatePreviewSession', () => {
    it('throws PreviewSessionNotFound when session file does not exist', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('unknown-sess');
      try {
        await validatePreviewSession(agent as never);
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionNotFound');
        expect((e as SfError).message).to.include('No preview session found');
      }
    });

    it('throws PreviewSessionNotFound when session id is for different agent', async () => {
      const agentA = makeMockAgent(projectPath, 'agent-a');
      const agentB = makeMockAgent(projectPath, 'agent-b');
      (agentA as { setSessionId: (id: string) => void }).setSessionId('sess-1');
      await createCache(agentA as never);
      (agentB as { setSessionId: (id: string) => void }).setSessionId('sess-1');
      try {
        await validatePreviewSession(agentB as never);
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionNotFound');
      }
    });

    it('succeeds when session exists for this agent', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent as never);
      agent.setSessionId('sess-1');
      await validatePreviewSession(agent as never);
    });
  });
});
