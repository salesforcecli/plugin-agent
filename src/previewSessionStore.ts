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

import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { SfError } from '@salesforce/core';
import type { SfProject } from '@salesforce/core';
import type { ProductionAgent, ScriptAgent } from '@salesforce/agents';

const SESSION_META_FILE = 'session-meta.json';
const SESSION_INDEX_FILE = 'index.json';

export type SessionType = 'simulated' | 'live' | 'published';
export type SessionMeta = { displayName?: string; timestamp?: string; sessionType?: SessionType };
type SessionIndex = Array<{
  sessionId: string;
  displayName?: string;
  timestamp?: string;
  sessionType?: SessionType;
}>;

/**
 * Save a marker so send/end can validate that the session was started for this agent.
 * Caller must have started the session (agent has sessionId set). Uses agent.getHistoryDir() for the path.
 * Pass displayName (authoring bundle name or production agent API name) so "agent preview sessions" can show it.
 */
export async function createCache(
  agent: ScriptAgent | ProductionAgent,
  options?: { displayName?: string; sessionType?: SessionType }
): Promise<void> {
  const historyDir = await agent.getHistoryDir();
  const metaPath = join(historyDir, SESSION_META_FILE);
  const meta: SessionMeta = {
    displayName: options?.displayName,
    timestamp: new Date().toISOString(),
    sessionType: options?.sessionType,
  };
  await writeFile(metaPath, JSON.stringify(meta), 'utf-8');

  // Update the sessions index for ordered browsing
  const sessionId = basename(historyDir);
  const sessionsDir = dirname(historyDir);
  const indexPath = join(sessionsDir, SESSION_INDEX_FILE);
  await updateSessionIndex(indexPath, (index) => {
    if (!index.some((e) => e.sessionId === sessionId)) {
      index.push({
        sessionId,
        displayName: meta.displayName,
        timestamp: meta.timestamp,
        sessionType: meta.sessionType,
      });
    }
    return index;
  });
}

/**
 * Validate that the session was started for this agent (marker file exists in agent's history dir for current sessionId).
 * Caller must set sessionId on the agent (agent.setSessionId) before calling.
 * Throws SfError if the session marker is not found.
 */
export async function validatePreviewSession(agent: ScriptAgent | ProductionAgent): Promise<void> {
  const historyDir = await agent.getHistoryDir();
  const metaPath = join(historyDir, SESSION_META_FILE);
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
 * Remove the session marker so this session is no longer considered "active" for send/end without --session-id.
 * Call after ending the session. Caller must set sessionId on the agent before calling.
 */
export async function removeCache(agent: ScriptAgent | ProductionAgent): Promise<void> {
  const historyDir = await agent.getHistoryDir();
  const metaPath = join(historyDir, SESSION_META_FILE);
  try {
    await unlink(metaPath);
  } catch {
    // already removed or never created
  }

  // Remove entry from the sessions index
  const sessionId = basename(historyDir);
  const sessionsDir = dirname(historyDir);
  const indexPath = join(sessionsDir, SESSION_INDEX_FILE);
  await updateSessionIndex(indexPath, (index) => index.filter((e) => e.sessionId !== sessionId));
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

export type CachedSessionInfo = { sessionId: string; timestamp?: string; sessionType?: SessionType };
export type CachedSessionEntry = { agentId: string; displayName?: string; sessions: CachedSessionInfo[] };

/**
 * Read the sessions index file, returning an empty array if missing or unreadable.
 */
async function readSessionIndex(indexPath: string): Promise<SessionIndex> {
  try {
    const raw = await readFile(indexPath, 'utf-8');
    return JSON.parse(raw) as SessionIndex;
  } catch {
    return [];
  }
}

/**
 * Atomically read-modify-write the sessions index.
 * Writes to a temp file then renames to avoid partial writes and reduce
 * the window for concurrent-write races (last writer wins, no silent drops).
 * Propagates errors so callers are aware of index failures.
 */
async function updateSessionIndex(indexPath: string, updater: (index: SessionIndex) => SessionIndex): Promise<void> {
  const index = await readSessionIndex(indexPath);
  const updated = updater(index);
  const tmpPath = `${indexPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
  await rename(tmpPath, indexPath);
}

/**
 * List all cached preview sessions in the project, grouped by agent ID.
 * displayName (when present in session-meta.json) is the authoring bundle name or production agent API name for display.
 * Use this to show users which sessions exist so they can end or clean up.
 */
export async function listCachedSessions(project: SfProject): Promise<CachedSessionEntry[]> {
  const base = join(project.getPath(), '.sfdx', 'agents');
  const result: CachedSessionEntry[] = [];
  try {
    const agentDirs = await readdir(base, { withFileTypes: true });
    const entries = await Promise.all(
      agentDirs
        .filter((ent) => ent.isDirectory())
        .map(async (ent) => {
          const agentId = ent.name;
          const sessionsDir = join(base, agentId, 'sessions');
          let sessions: CachedSessionInfo[] = [];
          let displayName: string | undefined;
          try {
            // Prefer the index for ordered, metadata-rich results
            const index = await readSessionIndex(join(sessionsDir, SESSION_INDEX_FILE));
            if (index.length > 0) {
              // Verify each indexed session still has its marker file (guard against manual cleanup)
              const verified = await Promise.all(
                index.map(async (entry) => {
                  try {
                    await readFile(join(sessionsDir, entry.sessionId, SESSION_META_FILE), 'utf-8');
                    return entry;
                  } catch {
                    return null;
                  }
                })
              );
              sessions = verified
                .filter((e): e is SessionIndex[number] => e !== null)
                .map(({ sessionId, timestamp, sessionType }) => ({ sessionId, timestamp, sessionType }));
              displayName = index[0]?.displayName;
            } else {
              // Fallback: scan directories (no index yet, e.g. sessions started before this feature)
              const sessionDirs = await readdir(sessionsDir, { withFileTypes: true });
              const sessionInfos = await Promise.all(
                sessionDirs
                  .filter((s) => s.isDirectory())
                  .map(async (s): Promise<(CachedSessionInfo & { displayName?: string }) | null> => {
                    try {
                      const raw = await readFile(join(sessionsDir, s.name, SESSION_META_FILE), 'utf-8');
                      const meta = JSON.parse(raw) as SessionMeta;
                      return {
                        sessionId: s.name,
                        timestamp: meta.timestamp,
                        sessionType: meta.sessionType,
                        displayName: meta.displayName,
                      };
                    } catch {
                      return null;
                    }
                  })
              );
              const validSessions = sessionInfos.filter(
                (s): s is CachedSessionInfo & { displayName?: string } => s !== null
              );
              sessions = validSessions.map(({ sessionId, timestamp, sessionType }) => ({
                sessionId,
                timestamp,
                sessionType,
              }));
              displayName = validSessions[0]?.displayName;
            }
          } catch {
            // no sessions dir or unreadable
          }
          return { agentId, displayName, sessions };
        })
    );
    result.push(...entries.filter((e) => e.sessions.length > 0));
  } catch {
    // no agents dir or unreadable
  }
  return result;
}
