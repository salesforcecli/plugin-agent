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
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { getAgentForActivation } from '../../agentActivation.js';

export type AgentActivateResult = { success: boolean; version: number };

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.activate');

export default class AgentActivate extends SfCommand<AgentActivateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
    }),
    version: Flags.integer({ summary: messages.getMessage('flags.version.summary') }),
  };

  public async run(): Promise<AgentActivateResult> {
    const { flags } = await this.parse(AgentActivate);

    const apiNameFlag = flags['api-name'];
    const targetOrg = flags['target-org'];

    if (!apiNameFlag && this.jsonEnabled()) {
      throw messages.createError('error.missingRequiredFlags', ['api-name']);
    }
    const agent = await getAgentForActivation({ targetOrg, status: 'Active', apiNameFlag });
    const result = await agent.activate(flags.version);

    this.log(`Agent ${result.DeveloperName} activated.`);
    return { success: true, version: result.VersionNumber };
  }
}
