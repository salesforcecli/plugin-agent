/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { getAgentForActivation } from '../../agentActivation.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.activate');

export default class AgentActivate extends SfCommand<void> {
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
    const { flags } = await this.parse(AgentActivate);

    const apiNameFlag = flags['api-name'];
    const targetOrg = flags['target-org'];
    const conn = targetOrg.getConnection(flags['api-version']);

    if (!apiNameFlag && this.jsonEnabled()) {
      throw messages.createError('error.missingRequiredFlags', ['api-name']);
    }

    const agent = await getAgentForActivation({ conn, targetOrg, status: 'Active', apiNameFlag });
    await agent.activate();
    const agentName = (await agent.getBotMetadata()).DeveloperName;

    this.log(`Agent ${agentName} activated.`);
  }
}
