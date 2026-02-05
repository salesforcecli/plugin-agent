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

import { join } from 'node:path';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Agent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import { validatePreviewSession } from '../../../previewSessionStore.js';

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
  public static readonly state = 'beta';
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
      required: true,
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
    const sessionId = flags['session-id'];
    const projectPath = this.project!.getPath();

    await validatePreviewSession(projectPath, sessionId, {
      apiNameOrId: flags['api-name'],
      aabName: flags['authoring-bundle'],
      orgUsername: flags['target-org'].getUsername() ?? '',
    });

    const conn = flags['target-org'].getConnection(flags['api-version']);
    const agent = flags['authoring-bundle']
      ? await Agent.init({ connection: conn, project: this.project!, aabName: flags['authoring-bundle'] })
      : await Agent.init({ connection: conn, project: this.project!, apiNameOrId: flags['api-name']! });

    if (agent instanceof ScriptAgent) {
      await agent.preview.end();
    } else if (agent instanceof ProductionAgent) {
      await agent.preview.end('UserRequest');
    }

    const tracesPath = join(projectPath, '.sfdx', 'agents', agent.getAgentIdForStorage(), 'sessions', sessionId);
    const result = { sessionId, tracesPath };
    this.log(messages.getMessage('output.tracesPath', [tracesPath]));
    return result;
  }
}
