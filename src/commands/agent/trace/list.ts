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

import { Flags, SfCommand, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { listCachedPreviewSessions, listSessionTraces, type TraceFileInfo } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.trace.list');

const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/;

export type AgentTraceListResult = Array<{
  agent: string;
  sessionId: string;
  planId: string;
  path: string;
  size: number;
  mtime: string;
}>;

export default class AgentTraceList extends SfCommand<AgentTraceListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Trace files listed successfully (or empty list if none found).',
  });

  public static readonly flags = {
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
    }),
    agent: Flags.string({
      summary: messages.getMessage('flags.agent.summary'),
      char: 'a',
    }),
    since: Flags.custom<Date>({
      summary: messages.getMessage('flags.since.summary'),
      description: messages.getMessage('flags.since.description'),
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (raw): Promise<Date> => {
        if (!ISO_8601.test(raw)) {
          throw new SfError(messages.getMessage('error.invalidSince', [raw]), 'InvalidDate');
        }
        const d = new Date(raw);
        if (isNaN(d.getTime())) {
          throw new SfError(messages.getMessage('error.invalidSince', [raw]), 'InvalidDate');
        }
        return d;
      },
    })(),
  };

  public async run(): Promise<AgentTraceListResult> {
    const { flags } = await this.parse(AgentTraceList);

    const agentNameFilter = flags.agent?.toLowerCase();

    const cachedAgents = await listCachedPreviewSessions(this.project!);

    const result: AgentTraceListResult = [];

    for (const { agentId, displayName, sessions } of cachedAgents) {
      if (agentNameFilter && !displayName?.toLowerCase().includes(agentNameFilter)) continue;

      for (const { sessionId } of sessions) {
        if (flags['session-id'] && sessionId !== flags['session-id']) continue;

        // eslint-disable-next-line no-await-in-loop
        let traces: TraceFileInfo[] = await listSessionTraces(agentId, sessionId);

        if (flags.since) {
          traces = traces.filter((t) => t.mtime >= flags.since!);
        }

        for (const t of traces) {
          result.push({
            agent: displayName ?? agentId,
            sessionId,
            planId: t.planId,
            path: t.path,
            size: t.size,
            mtime: t.mtime.toISOString(),
          });
        }
      }
    }

    if (result.length === 0) {
      this.log(messages.getMessage('output.empty'));
      return [];
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: result.map((r) => ({ ...r, size: `${r.size}B` })),
        columns: [
          { key: 'agent', name: messages.getMessage('output.tableHeader.agent') },
          { key: 'sessionId', name: messages.getMessage('output.tableHeader.sessionId') },
          { key: 'planId', name: messages.getMessage('output.tableHeader.planId') },
          { key: 'mtime', name: messages.getMessage('output.tableHeader.mtime') },
          { key: 'size', name: messages.getMessage('output.tableHeader.size') },
          { key: 'path', name: messages.getMessage('output.tableHeader.path') },
        ],
      });
    }

    return result;
  }
}
