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
import { Agent } from '@salesforce/agents';
import { getCachedSessionIds, validatePreviewSession } from '../../../previewSessionStore.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview.send');

export type AgentPreviewSendResult = {
  messages: Array<{ message?: string; role?: string }>;
  agentApiName: string;
  sessionId: string;
};

export default class AgentPreviewSend extends SfCommand<AgentPreviewSendResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Message sent successfully and agent response received.',
    'NotFound (2)': 'Agent not found, or no preview session exists for this agent.',
    'PreviewSendFailed (4)': 'Failed to send message or receive response from the preview session.',
    'SessionAmbiguous (5)': 'Multiple preview sessions found; specify --session-id to choose one.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
      required: false,
    }),
    utterance: Flags.string({
      summary: messages.getMessage('flags.utterance.summary'),
      required: true,
      char: 'u',
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

  public async run(): Promise<AgentPreviewSendResult> {
    const { flags } = await this.parse(AgentPreviewSend);
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
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_send_agent_not_found' });
      throw new SfError(messages.getMessage('error.agentNotFound', [agentIdentifier]), 'AgentNotFound', [], 2, wrapped);
    }

    // Get or validate session ID
    let sessionId = flags['session-id'];
    if (sessionId === undefined) {
      const cached = await getCachedSessionIds(this.project!, agent);
      if (cached.length === 0) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_send_no_session' });
        throw new SfError(messages.getMessage('error.noSession'), 'PreviewSessionNotFound', [], 2);
      }
      if (cached.length > 1) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_send_multiple_sessions' });
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
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_send_session_invalid' });
      throw new SfError(
        messages.getMessage('error.sessionInvalid', [sessionId]),
        'PreviewSessionInvalid',
        [],
        2,
        wrapped
      );
    }

    // Send message with error tracking
    let response;
    try {
      response = await agent.preview.send(flags.utterance);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_send_failed' });
      throw new SfError(
        messages.getMessage('error.sendFailed', [wrapped.message]),
        'PreviewSendFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

    await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_send_success' });
    this.log(response.messages[0].message);
    return { messages: response.messages ?? [], agentApiName: agentIdentifier, sessionId };
  }
}
