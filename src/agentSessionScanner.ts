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

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type SfProject } from '@salesforce/core';
import { listCachedPreviewSessions } from '@salesforce/agents';

export type AgentSession = { agentId: string; displayName: string; sessionId: string };

/**
 * Returns all sessions that have trace data on disk — both active sessions (still in the
 * cache index) and ended sessions (removed from the index by `agent preview end` but whose
 * trace directories remain under .sfdx/agents/<agentId>/sessions/<sessionId>/).
 */
export async function listAllAgentSessions(project: SfProject): Promise<AgentSession[]> {
  const cached = await listCachedPreviewSessions(project);
  const active: AgentSession[] = cached.flatMap(({ agentId, displayName, sessions }) =>
    sessions.map(({ sessionId }) => ({ agentId, displayName: displayName ?? agentId, sessionId }))
  );

  const seen = new Set(active.map((s) => s.sessionId));

  const agentsDir = join(project.getPath(), '.sfdx', 'agents');
  const ended: AgentSession[] = [];
  try {
    const agentDirs = await readdir(agentsDir, { withFileTypes: true });
    for (const agentEnt of agentDirs) {
      if (!agentEnt.isDirectory()) continue;
      const sessionsDir = join(agentsDir, agentEnt.name, 'sessions');
      try {
        // eslint-disable-next-line no-await-in-loop
        const sessionDirs = await readdir(sessionsDir, { withFileTypes: true });
        for (const sessEnt of sessionDirs) {
          if (!sessEnt.isDirectory() || seen.has(sessEnt.name)) continue;
          ended.push({ agentId: agentEnt.name, displayName: agentEnt.name, sessionId: sessEnt.name });
          seen.add(sessEnt.name);
        }
      } catch {
        // no sessions dir for this agent
      }
    }
  } catch {
    // no .sfdx/agents dir yet
  }

  return [...active, ...ended];
}
