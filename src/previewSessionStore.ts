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

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SfError } from '@salesforce/core';
import type { SfProject } from '@salesforce/core';
import type { ProductionAgent, ScriptAgent } from '@salesforce/agents';

const SESSION_META_FILE = 'session-meta.json';

/**
 * Save a marker so send/end can validate that the session was started for this agent.
 * Caller must have started the session (agent has sessionId set). Uses agent.getHistoryDir() for the path.
 */
export async function createCache(agent: ScriptAgent | ProductionAgent): Promise<void> {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  const historyDir = await agent.getHistoryDir();
  const metaPath = join(historyDir, SESSION_META_FILE);
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  await writeFile(metaPath, JSON.stringify({}), 'utf-8');
}

/**
 * Validate that the session was started for this agent (marker file exists in agent's history dir for current sessionId).
 * Caller must set sessionId on the agent (agent.setSessionId) before calling.
 * Throws SfError if the session marker is not found.
 */
export async function validatePreviewSession(agent: ScriptAgent | ProductionAgent): Promise<void> {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  const historyDir = await agent.getHistoryDir();
  const metaPath = join(historyDir, SESSION_META_FILE);
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  try {
    await readFile(metaPath, 'utf-8');
  } catch {
    throw new SfError(
      'No preview session found for this session ID. Run "sf agent preview start" first.',
      'PreviewSessionNotFound'
    );
  }
}

/**
 * List session IDs that have a cache marker (started via "agent preview start") for this agent.
 * Uses project path and agent's storage ID to find .sfdx/agents/<agentId>/sessions/<sessionId>/session-meta.json.
 */
export async function getCachedSessionIds(project: SfProject, agent: ScriptAgent | ProductionAgent): Promise<string[]> {
  const agentId = agent.getAgentIdForStorage();
  const base = join(project.getPath(), '.sfdx');
  const sessionsDir = join(base, 'agents', agentId, 'sessions');
  const sessionIds: string[] = [];
  try {
    const entries = await readdir(sessionsDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const hasMarker = await Promise.all(
      dirs.map(async (name) => {
        try {
          await readFile(join(sessionsDir, name, SESSION_META_FILE), 'utf-8');
          return true;
        } catch {
          return false;
        }
      })
    );
    dirs.forEach((name, i) => {
      if (hasMarker[i]) sessionIds.push(name);
    });
  } catch {
    // sessions dir missing or unreadable
  }
  return sessionIds;
}

/**
 * Return the single "current" session ID when safe: exactly one cached session for this agent.
 * Returns undefined when there are zero or multiple sessions (caller should require --session-id).
 */
export async function getCurrentSessionId(
  project: SfProject,
  agent: ScriptAgent | ProductionAgent
): Promise<string | undefined> {
  const ids = await getCachedSessionIds(project, agent);
  return ids.length === 1 ? ids[0] : undefined;
}
