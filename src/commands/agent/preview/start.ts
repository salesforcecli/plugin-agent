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

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages } from '@salesforce/core';
import { Agent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import { createCache } from '../../../previewSessionStore.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview.start');

export type AgentPreviewStartResult = {
  sessionId: string;
};

export default class AgentPreviewStart extends SfCommand<AgentPreviewStartResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
      exactlyOne: ['api-name', 'authoring-bundle'],
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      exactlyOne: ['api-name', 'authoring-bundle'],
    }),
    'use-live-actions': Flags.boolean({
      summary: messages.getMessage('flags.use-live-actions.summary'),
      default: false,
    }),
  };

  public async run(): Promise<AgentPreviewStartResult> {
    const { flags } = await this.parse(AgentPreviewStart);
    const conn = flags['target-org'].getConnection(flags['api-version']);
    const useLiveActions = flags['use-live-actions'];

    const agent = flags['authoring-bundle']
      ? await Agent.init({ connection: conn, project: this.project!, aabName: flags['authoring-bundle'] })
      : await Agent.init({ connection: conn, project: this.project!, apiNameOrId: flags['api-name']! });
    if (agent instanceof ScriptAgent) {
      agent.preview.setMockMode(useLiveActions ? 'Live Test' : 'Mock');
    }

    if (useLiveActions && agent instanceof ProductionAgent) {
      void Lifecycle.getInstance().emitWarning(
        'Published agents always use real actions; --use-live-actions has no effect for published agents.'
      );
    }

    const session = await agent.preview.start();
    await createCache(agent);

    const result: AgentPreviewStartResult = { sessionId: session.sessionId };
    this.log(messages.getMessage('output.sessionId', [session.sessionId]));
    return result;
  }
}
