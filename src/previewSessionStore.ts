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

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SfError } from '@salesforce/core';

const CACHE_DIR = '.sfdx';
const AGENTS_DIR = 'agents';
const SESSIONS_FILE = 'preview-sessions.json';

export type PreviewSessionEntry = {
  sessionId: string;
  orgUsername: string;
  apiNameOrId?: string;
  aabName?: string;
};

type SessionsStore = Record<string, Omit<PreviewSessionEntry, 'sessionId'>>;

function getStorePath(projectPath: string): string {
  return join(projectPath, CACHE_DIR, AGENTS_DIR, SESSIONS_FILE);
}

/**
 * Save a preview session so send/end can validate that the session was started with the same agent and org.
 */
export async function createCache(projectPath: string, entry: PreviewSessionEntry): Promise<void> {
  const dir = join(projectPath, CACHE_DIR, AGENTS_DIR);
  await mkdir(dir, { recursive: true });
  const path = getStorePath(projectPath);
  let store: SessionsStore = {};
  try {
    const data = await readFile(path, 'utf-8');
    store = JSON.parse(data) as SessionsStore;
  } catch {
    // file missing or invalid
  }
  const { sessionId, ...rest } = entry;
  store[sessionId] = rest;
  await writeFile(path, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Validate that the given session was started with the specified agent and org.
 * Throws SfError if the session is unknown or does not match.
 */
export async function validatePreviewSession(
  projectPath: string,
  sessionId: string,
  agentAndOrg: { apiNameOrId?: string; aabName?: string; orgUsername: string }
): Promise<void> {
  let data: string;
  try {
    data = await readFile(getStorePath(projectPath), 'utf-8');
  } catch {
    throw new SfError(
      `No preview session found for session ID "${sessionId}". Run "sf agent preview start" first.`,
      'PreviewSessionNotFound'
    );
  }
  const store = JSON.parse(data) as SessionsStore;
  const entry = store[sessionId];
  if (!entry) {
    throw new SfError(
      `No preview session found for session ID "${sessionId}". Run "sf agent preview start" first.`,
      'PreviewSessionNotFound'
    );
  }
  if (entry.orgUsername !== agentAndOrg.orgUsername) {
    throw new SfError(
      `Session ${sessionId} was started with a different target org. Use --target-org ${entry.orgUsername} for this session.`,
      'PreviewSessionOrgMismatch'
    );
  }
  const entryAgent = entry.aabName ? `--authoring-bundle ${entry.aabName}` : `--api-name ${entry.apiNameOrId ?? ''}`;
  if (entry.aabName) {
    if (agentAndOrg.aabName !== entry.aabName) {
      throw new SfError(
        `Session ${sessionId} was started with ${entryAgent}. Use the same agent for send/end.`,
        'PreviewSessionAgentMismatch'
      );
    }
  } else if (agentAndOrg.apiNameOrId !== entry.apiNameOrId) {
    throw new SfError(
      `Session ${sessionId} was started with ${entryAgent}. Use the same agent for send/end.`,
      'PreviewSessionAgentMismatch'
    );
  }
}
