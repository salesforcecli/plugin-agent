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
import { SfError, SfProject } from '@salesforce/core';
import type { ProductionAgent, ScriptAgent } from '@salesforce/agents';
import {
  createCache,
  getCachedSessionIds,
  getCurrentSessionId,
  listCachedSessions,
  removeCache,
  validatePreviewSession,
} from '../src/previewSessionStore.js';

function makeMockProject(getPath: () => string): SfProject {
  return { getPath } as SfProject;
}

function makeMockAgent(projectDir: string, agentId: string): ScriptAgent | ProductionAgent {
  let sessionId: string | undefined;
  return {
    setSessionId(id: string) {
      sessionId = id;
    },
    getAgentIdForStorage(): string {
      return agentId;
    },
    async getHistoryDir(): Promise<string> {
      if (!sessionId) throw new Error('sessionId not set');
      const dir = join(projectDir, '.sfdx', 'agents', agentId, 'sessions', sessionId);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(dir, { recursive: true });
      return dir;
    },
  } as ScriptAgent | ProductionAgent;
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
      await createCache(agent);
      agent.setSessionId('sess-1');
      await validatePreviewSession(agent);
    });

    it('allows multiple sessions for same agent', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-a');
      await createCache(agent);
      agent.setSessionId('sess-b');
      await createCache(agent);
      agent.setSessionId('sess-a');
      await validatePreviewSession(agent);
      agent.setSessionId('sess-b');
      await validatePreviewSession(agent);
    });
  });

  describe('validatePreviewSession', () => {
    it('throws PreviewSessionNotFound when session file does not exist', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('unknown-sess');
      try {
        await validatePreviewSession(agent);
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
      agentA.setSessionId('sess-1');
      await createCache(agentA);
      agentB.setSessionId('sess-1');
      try {
        await validatePreviewSession(agentB);
        expect.fail('Expected validatePreviewSession to throw');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('PreviewSessionNotFound');
      }
    });

    it('succeeds when session exists for this agent', async () => {
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent);
      agent.setSessionId('sess-1');
      await validatePreviewSession(agent);
    });
  });

  describe('getCachedSessionIds', () => {
    it('returns empty when no sessions', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      const ids = await getCachedSessionIds(project, agent);
      expect(ids).to.deep.equal([]);
    });

    it('returns session ids that have session-meta.json', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent);
      agent.setSessionId('sess-2');
      await createCache(agent);
      const ids = await getCachedSessionIds(project, agent);
      expect(ids).to.have.members(['sess-1', 'sess-2']);
    });

    it('does not return session dirs without session-meta.json', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent);
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(projectPath, '.sfdx', 'agents', 'agent-1', 'sessions', 'other-dir'), {
        recursive: true,
      });
      const ids = await getCachedSessionIds(project, agent);
      expect(ids).to.deep.equal(['sess-1']);
    });
  });

  describe('removeCache', () => {
    it('removes session from cache so getCachedSessionIds no longer includes it', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent);
      agent.setSessionId('sess-2');
      await createCache(agent);
      let ids = await getCachedSessionIds(project, agent);
      expect(ids).to.have.members(['sess-1', 'sess-2']);
      agent.setSessionId('sess-1');
      await removeCache(agent);
      ids = await getCachedSessionIds(project, agent);
      expect(ids).to.deep.equal(['sess-2']);
    });

    it('after removing one of two sessions, getCurrentSessionId returns the remaining session', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-a');
      await createCache(agent);
      agent.setSessionId('sess-b');
      await createCache(agent);
      expect(await getCurrentSessionId(project, agent)).to.be.undefined;
      agent.setSessionId('sess-a');
      await removeCache(agent);
      expect(await getCurrentSessionId(project, agent)).to.equal('sess-b');
    });
  });

  describe('listCachedSessions', () => {
    it('returns empty when no cached sessions', async () => {
      const project = makeMockProject(() => projectPath);
      const list = await listCachedSessions(project);
      expect(list).to.deep.equal([]);
    });

    it('returns agent ids and session ids for all cached sessions', async () => {
      const project = makeMockProject(() => projectPath);
      const agent1 = makeMockAgent(projectPath, 'bundle-a');
      agent1.setSessionId('s1');
      await createCache(agent1);
      agent1.setSessionId('s2');
      await createCache(agent1);
      const agent2 = makeMockAgent(projectPath, 'bundle-b');
      agent2.setSessionId('s3');
      await createCache(agent2);
      const list = await listCachedSessions(project);
      expect(list).to.have.lengthOf(2);
      const byAgent = Object.fromEntries(list.map((e) => [e.agentId, e.sessionIds]));
      expect(byAgent['bundle-a']).to.have.members(['s1', 's2']);
      expect(byAgent['bundle-b']).to.deep.equal(['s3']);
    });

    it('returns displayName from session-meta when createCache was called with displayName', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'some-id');
      agent.setSessionId('s1');
      await createCache(agent, { displayName: 'My_Production_Agent' });
      const list = await listCachedSessions(project);
      expect(list).to.have.lengthOf(1);
      expect(list[0].agentId).to.equal('some-id');
      expect(list[0].displayName).to.equal('My_Production_Agent');
      expect(list[0].sessionIds).to.deep.equal(['s1']);
    });
  });

  describe('getCurrentSessionId', () => {
    it('returns undefined when no sessions', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      const id = await getCurrentSessionId(project, agent);
      expect(id).to.be.undefined;
    });

    it('returns session id when exactly one session', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-1');
      await createCache(agent);
      const id = await getCurrentSessionId(project, agent);
      expect(id).to.equal('sess-1');
    });

    it('returns undefined when multiple sessions', async () => {
      const project = makeMockProject(() => projectPath);
      const agent = makeMockAgent(projectPath, 'agent-1');
      agent.setSessionId('sess-a');
      await createCache(agent);
      agent.setSessionId('sess-b');
      await createCache(agent);
      const id = await getCurrentSessionId(project, agent);
      expect(id).to.be.undefined;
    });
  });
});
