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

import { resolve } from 'node:path';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import React from 'react';
import { render } from 'ink';
import { Agent, AgentSource, PreviewableAgent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import { select } from '@inquirer/prompts';
import { Lifecycle, Messages, SfError } from '@salesforce/core';
import { AgentPreviewReact } from '../../components/agent-preview-react.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview');

type BotVersionStatus = { Status: 'Active' | 'Inactive' };

export type AgentData = {
  Id: string;
  DeveloperName: string;
  BotVersions: {
    records: BotVersionStatus[];
  };
};

// https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#prerequisites
export const UNSUPPORTED_AGENTS = ['Copilot_for_Salesforce'];

export type AgentPreviewResult = {
  sessionId: string;
  response: string;
};
export default class AgentPreview extends SfCommand<AgentPreviewResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      char: 'd',
    }),
    'apex-debug': Flags.boolean({
      summary: messages.getMessage('flags.apex-debug.summary'),
      char: 'x',
    }),
    'use-live-actions': Flags.boolean({
      summary: messages.getMessage('flags.use-live-actions.summary'),
      default: false,
    }),
    utterance: Flags.string({
      summary: messages.getMessage('flags.utterance.summary'),
    }),
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<AgentPreviewResult> {
    // STAGES OF PREVIEW
    // get user's agent selection either from flags, or interaction
    // if .agent selected, use the AgentSimulate class to preview
    // if published agent, use AgentPreview for preview
    const { flags } = await this.parse(AgentPreview);

    const {
      'api-name': apiNameOrId,
      'use-live-actions': useLiveActions,
      'authoring-bundle': aabName,
      utterance,
      'session-id': sessionId,
    } = flags;

    if (sessionId && !utterance) {
      throw new SfError(messages.getMessage('error.sessionIdRequiresUtterance'), 'SessionIdRequiresUtterance');
    }

    if (utterance && !aabName && !apiNameOrId) {
      throw new SfError(messages.getMessage('error.utteranceRequiresAgent'), 'UtteranceRequiresAgent');
    }

    const conn = flags['target-org'].getConnection(flags['api-version']);

    let selectedAgent: ScriptAgent | ProductionAgent;

    if (aabName) {
      // user specified --authoring-bundle, use the API name directly
      selectedAgent = await Agent.init({ connection: conn, project: this.project!, aabName });
    } else if (apiNameOrId) {
      selectedAgent = await Agent.init({ connection: conn, project: this.project!, apiNameOrId });
    } else {
      const previewableAgents = await Agent.listPreviewable(conn, this.project!);
      const choices = previewableAgents.map((agent) => ({
        name: agent.source === AgentSource.PUBLISHED ? `${agent.name} (Published)` : `${agent.name} (Agent Script)`,
        value: agent,
      }));
      const choice = await select<PreviewableAgent>({
        message: 'Select an agent',
        choices,
      });

      if (choice.source === AgentSource.SCRIPT && choice.name) {
        // Use the API name directly
        selectedAgent = await Agent.init({
          connection: conn,
          project: this.project!,
          aabName: choice.name,
        });
        selectedAgent.preview.setMockMode(flags['use-live-actions'] ? 'Live Test' : 'Mock');
      } else {
        selectedAgent = await Agent.init({
          connection: conn,
          project: this.project!,
          // developerName will be set at this point since the user selected a production agent, even ID will be defined
          apiNameOrId: choice.developerName ?? choice.id ?? '',
        });
      }
    }

    if (useLiveActions && selectedAgent instanceof ProductionAgent) {
      void Lifecycle.getInstance().emitWarning(
        'Published agents will always use real actions in your org, specifying --use-live-actions and selecting a published agent has no effect'
      );
    }

    // Only resolve outputDir if explicitly provided via flag
    // Otherwise, let user decide when exiting
    const outputDir = flags['output-dir'] ? resolve(flags['output-dir']) : undefined;

    selectedAgent.preview.setApexDebugging(flags['apex-debug']);

    if (utterance) {
      // Non-interactive: send message and return response
      if (sessionId) {
        // Send to existing session
        (selectedAgent as unknown as { sessionId?: string }).sessionId = sessionId;
        const response = await selectedAgent.preview.send(utterance);
        const responseMessage = response.messages[0]?.message ?? '';
        if (!this.jsonEnabled()) {
          this.log(responseMessage);
        }
        return { sessionId, response: responseMessage };
      }

      // New session: start, send, end
      const session = await selectedAgent.preview.start();
      try {
        const response = await selectedAgent.preview.send(utterance);
        const responseMessage = response.messages[0]?.message ?? '';
        if (!this.jsonEnabled()) {
          this.log(messages.getMessage('output.sessionId', [session.sessionId]));
          this.log(responseMessage);
        }
        return { sessionId: session.sessionId, response: responseMessage };
      } finally {
        if (selectedAgent instanceof ScriptAgent) {
          await selectedAgent.preview.end();
        } else {
          await selectedAgent.preview.end('UserRequest');
        }
      }
    }

    const instance = render(
      React.createElement(AgentPreviewReact, {
        agent: selectedAgent.preview,
        name: selectedAgent.name ?? '',
        outputDir,
        isLocalAgent: selectedAgent instanceof ScriptAgent,
      }),
      { exitOnCtrlC: false }
    );
    await instance.waitUntilExit();
    // Interactive mode: return empty result for --json (non-interactive --utterance returns sessionId/response)
    return { sessionId: '', response: '' };
  }
}

export const agentIsUnsupported = (devName: string): boolean => UNSUPPORTED_AGENTS.includes(devName);

export const agentIsInactive = (agent: AgentData): boolean =>
  // Agent versioning is not fully supported yet, but this should ensure at least one version is active
  agent.BotVersions.records.every((botVersion) => botVersion.Status === 'Inactive');

export const validateAgent = (agent: AgentData): boolean => {
  // Agents must be active in Agent Builder
  if (agentIsInactive(agent)) {
    throw new SfError(`Agent ${agent.DeveloperName} is inactive.`);
  }
  // The default agent is not supported
  if (agentIsUnsupported(agent.DeveloperName)) {
    throw new SfError(`Agent ${agent.DeveloperName} is not supported.`, 'DefaultAgentNotSupported', [
      'See https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#prerequisites',
    ]);
  }

  return true;
};
