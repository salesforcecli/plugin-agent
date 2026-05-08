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

import { unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Flags, SfCommand, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages, SfError, type SfProject } from '@salesforce/core';
import { listCachedPreviewSessions, listSessionTraces, type TraceFileInfo } from '@salesforce/agents';
import yesNoOrCancel from '../../../yes-no-cancel.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.trace.delete');

const DURATION_RE = /^(\d+)(d|h|m|w|days?|hours?|minutes?|weeks?)$/i;
const UNIT_MS: Record<string, number> = {
  m: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,
};

type AgentSession = { agentId: string; displayName: string; sessionId: string };

async function listAllAgentSessions(project: SfProject): Promise<AgentSession[]> {
  // Active sessions (have session-meta.json marker)
  const cached = await listCachedPreviewSessions(project);
  const active: AgentSession[] = cached.flatMap(({ agentId, displayName, sessions }) =>
    sessions.map(({ sessionId }) => ({ agentId, displayName: displayName ?? agentId, sessionId }))
  );

  // Build a set of already-known sessionIds so we don't double-count
  const seen = new Set(active.map((s) => s.sessionId));

  // Ended sessions: trace dirs still exist on disk but are removed from the index
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
        // no sessions dir
      }
    }
  } catch {
    // no .sfdx/agents dir yet
  }

  return [...active, ...ended];
}

export type AgentTraceDeleteResult = Array<{
  agent: string;
  sessionId: string;
  planId: string;
  path: string;
}>;

export default class AgentTraceDelete extends SfCommand<AgentTraceDeleteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Traces deleted successfully (or no traces matched).',
  });

  public static readonly flags = {
    agent: Flags.string({
      summary: messages.getMessage('flags.agent.summary'),
      char: 'a',
    }),
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
    }),
    'older-than': Flags.custom<Date>({
      summary: messages.getMessage('flags.older-than.summary'),
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (raw): Promise<Date> => {
        const match = DURATION_RE.exec(raw);
        if (!match) {
          throw new SfError(messages.getMessage('error.invalidOlderThan', [raw]), 'InvalidDuration');
        }
        const ms = parseInt(match[1], 10) * UNIT_MS[match[2].toLowerCase()];
        return new Date(Date.now() - ms);
      },
    })(),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
    }),
  };

  public async run(): Promise<AgentTraceDeleteResult> {
    const { flags } = await this.parse(AgentTraceDelete);

    const agentFilter = flags.agent?.toLowerCase();
    const allSessions = await listAllAgentSessions(this.project!);

    const candidates: AgentTraceDeleteResult = [];
    for (const { agentId, displayName, sessionId } of allSessions) {
      if (agentFilter && !displayName.toLowerCase().includes(agentFilter)) continue;
      if (flags['session-id'] && sessionId !== flags['session-id']) continue;

      // eslint-disable-next-line no-await-in-loop
      let traces: TraceFileInfo[] = await listSessionTraces(agentId, sessionId);

      if (flags['older-than']) {
        traces = traces.filter((t) => t.mtime < flags['older-than']!);
      }

      for (const t of traces) {
        candidates.push({ agent: displayName, sessionId, planId: t.planId, path: t.path });
      }
    }

    if (candidates.length === 0) {
      this.log(messages.getMessage('output.noneFound'));
      return [];
    }

    if (!flags['no-prompt']) {
      this.log(messages.getMessage('output.preview', [candidates.length]));
      this.table({
        data: candidates.map((c) => ({ agent: c.agent, sessionId: c.sessionId, planId: c.planId })),
        columns: [
          { key: 'agent', name: messages.getMessage('output.tableHeader.agent') },
          { key: 'sessionId', name: messages.getMessage('output.tableHeader.sessionId') },
          { key: 'planId', name: messages.getMessage('output.tableHeader.planId') },
        ],
      });

      const confirmed = await yesNoOrCancel({
        message: messages.getMessage('prompt.confirm', [candidates.length]),
        default: false,
      });

      if (confirmed === 'cancel' || confirmed === false) {
        this.log(messages.getMessage('output.cancelled'));
        return [];
      }
    }

    await Promise.all(candidates.map((c) => unlink(c.path)));
    this.log(messages.getMessage('output.deleted', [candidates.length]));
    return candidates;
  }
}
