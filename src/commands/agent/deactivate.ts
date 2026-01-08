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

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.deactivate');

export default class AgentDeactivate extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AgentDeactivate);

    const apiNameFlag = flags['api-name'];
    const targetOrg = flags['target-org'];
    const conn = targetOrg.getConnection(flags['api-version']);

    if (!apiNameFlag && this.jsonEnabled()) {
      throw messages.createError('error.missingRequiredFlags', ['api-name']);
    }

    const agent = await getAgentForActivation({ conn, targetOrg, status: 'Inactive', apiNameFlag });
    await agent.deactivate();
    const agentName = (await agent.getBotMetadata()).DeveloperName;

    this.log(`Agent ${agentName} deactivated.`);
  }
}
