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
import { Messages, SfError, Lifecycle, EnvironmentVariable } from '@salesforce/core';
import { Agent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import { getCachedSessionIds, removeCache, validatePreviewSession } from '../../../previewSessionStore.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview.end');

export type AgentPreviewEndResult = {
  sessionId: string;
  tracesPath: string;
};

export default class AgentPreviewEnd extends SfCommand<AgentPreviewEndResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Preview session ended successfully and traces saved.',
    'NotFound (2)': 'Agent not found, or no preview session exists for this agent.',
    'PreviewEndFailed (4)': 'Failed to end the preview session.',
    'SessionAmbiguous (5)': 'Multiple preview sessions found; specify --session-id to choose one.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
      required: false,
    }),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
      exactlyOne: ['api-name', 'authoring-bundle'],
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      exactlyOne: ['api-name', 'authoring-bundle'],
    }),
  };

  public async run(): Promise<AgentPreviewEndResult> {
    const { flags } = await this.parse(AgentPreviewEnd);
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const agentIdentifier = flags['authoring-bundle'] ?? flags['api-name']!;

    // Initialize agent with error tracking
    let agent;
    try {
      agent = flags['authoring-bundle']
        ? await Agent.init({ connection: conn, project: this.project!, aabName: flags['authoring-bundle'] })
        : await Agent.init({ connection: conn, project: this.project!, apiNameOrId: flags['api-name']! });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_end_agent_not_found' });
      throw new SfError(messages.getMessage('error.agentNotFound', [agentIdentifier]), 'AgentNotFound', [], 2, wrapped);
    }

    // Get or validate session ID
    let sessionId = flags['session-id'];
    if (sessionId === undefined) {
      const cached = await getCachedSessionIds(this.project!, agent);
      if (cached.length === 0) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_end_no_session' });
        throw new SfError(messages.getMessage('error.noSession'), 'PreviewSessionNotFound', [], 2);
      }
      if (cached.length > 1) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_end_multiple_sessions' });
        throw new SfError(
          messages.getMessage('error.multipleSessions', [cached.join(', ')]),
          'PreviewSessionAmbiguous',
          [],
          5
        );
      }
      sessionId = cached[0];
    }

    agent.setSessionId(sessionId);

    // Validate session
    try {
      await validatePreviewSession(agent);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_end_session_invalid' });
      throw new SfError(
        messages.getMessage('error.sessionInvalid', [sessionId]),
        'PreviewSessionInvalid',
        [],
        2,
        wrapped
      );
    }

    const tracesPath = await agent.getHistoryDir();
    await removeCache(agent);

    // End preview with error tracking
    try {
      if (agent instanceof ScriptAgent) {
        await agent.preview.end();
      } else if (agent instanceof ProductionAgent) {
        await agent.preview.end('UserRequest');
      }
    } catch (error) {
      const wrapped = SfError.wrap(error);
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_end_failed' });
      throw new SfError(
        messages.getMessage('error.endFailed', [wrapped.message]),
        'PreviewEndFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

    await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_end_success' });
    const result = { sessionId, tracesPath };
    this.log(messages.getMessage('output.tracesPath', [tracesPath]));
    return result;
  }
}
