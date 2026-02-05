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

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SfError } from '@salesforce/core';
import type { AgentInstance } from '@salesforce/agents';

const SESSION_META_FILE = 'session-meta.json';

/**
 * Save a marker so send/end can validate that the session was started for this agent.
 * Caller must have started the session (agent has sessionId set). Uses agent.getHistoryDir() for the path.
 */
export async function createCache(agent: AgentInstance): Promise<void> {
  const historyDir = await agent.getHistoryDir();
  const path = join(historyDir, SESSION_META_FILE);
  await writeFile(path, JSON.stringify({}), 'utf-8');
}

/**
 * Validate that the session was started for this agent (marker file exists in agent's history dir for current sessionId).
 * Caller must set sessionId on the agent (agent.setSessionId) before calling.
 * Throws SfError if the session marker is not found.
 */
export async function validatePreviewSession(agent: AgentInstance): Promise<void> {
  const historyDir = await agent.getHistoryDir();
  const path = join(historyDir, SESSION_META_FILE);
  try {
    await readFile(path, 'utf-8');
  } catch {
    throw new SfError(
      'No preview session found for this session ID. Run "sf agent preview start" first.',
      'PreviewSessionNotFound'
    );
  }
}
