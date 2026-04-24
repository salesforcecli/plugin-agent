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

import { SfCommand, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { listCachedSessions, SessionType } from '../../../previewSessionStore.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview.sessions');

export type AgentPreviewSessionsResult = Array<{
  agentId: string;
  displayName?: string;
  sessionId: string;
  timestamp?: string;
  sessionType?: SessionType;
}>;

export default class AgentPreviewSessions extends SfCommand<AgentPreviewSessionsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Sessions listed successfully (or empty list if no active sessions).',
  });

  public async run(): Promise<AgentPreviewSessionsResult> {
    const entries = await listCachedSessions(this.project!);
    const rows: AgentPreviewSessionsResult = [];
    for (const { agentId, displayName, sessions } of entries) {
      for (const { sessionId, timestamp, sessionType } of sessions) {
        rows.push({ agentId, displayName, sessionId, timestamp, sessionType });
      }
    }

    if (rows.length === 0) {
      this.log(messages.getMessage('output.empty'));
      return [];
    }

    if (this.jsonEnabled()) {
      return rows;
    }

    const agentColumnHeader = messages.getMessage('output.tableHeader.agent');
    const sessionIdHeader = messages.getMessage('output.tableHeader.sessionId');
    const timestampHeader = messages.getMessage('output.tableHeader.timestamp');
    const sessionTypeHeader = messages.getMessage('output.tableHeader.sessionType');
    const tableData = rows.map((r) => ({
      agent: r.displayName ?? r.agentId,
      sessionId: r.sessionId,
      timestamp: r.timestamp ?? '',
      sessionType: r.sessionType ?? '',
    }));
    this.table({
      data: tableData,
      columns: [
        { key: 'agent', name: agentColumnHeader },
        { key: 'sessionId', name: sessionIdHeader },
        { key: 'timestamp', name: timestampHeader },
        { key: 'sessionType', name: sessionTypeHeader },
      ],
    });
    return rows;
  }
}
