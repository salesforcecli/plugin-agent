/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create.spec');

export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  jobSpec?: string;
};

// This is a GET of '/services/data/v62.0/connect/agent-job-spec?agentType...

export default class AgentCreateSpec extends SfCommand<AgentCreateSpecResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'agent-type': Flags.string({
      required: true,
      summary: messages.getMessage('flags.agent-type.summary'),
      options: ['customer_facing', 'employee_facing'],
    }),
    role: Flags.string({
      required: true,
      summary: messages.getMessage('flags.role.summary'),
    }),
    'company-name': Flags.string({
      required: true,
      summary: messages.getMessage('flags.company-name.summary'),
    }),
    'company-description': Flags.string({
      required: true,
      summary: messages.getMessage('flags.company-description.summary'),
    }),
    'company-website': Flags.string({
      summary: messages.getMessage('flags.company-website.summary'),
    }),
    'output-dir': Flags.directory({
      char: 'd',
      exists: true,
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'config',
    }),
  };

  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpec);

    this.log(`Creating agent spec in: ${flags['output-dir']}`);

    // GET to /services/data/{api-version}/connect/agent-job-spec

    // Write a file with the returned job specs

    return {
      isSuccess: true,
    };
  }
}
