/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Duration, sleep } from '@salesforce/kit';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create');

export type AgentCreateResult = {
  isSuccess: boolean;
  errorMessage?: string;
};

// There is no API for this yet. It's being planned/built by the Agent Creator team.
// However, we could possibly use:
//   /services/data/{api-version}/connect/attach-agent-topics

export default class AgentCreate extends SfCommand<AgentCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    spec: Flags.file({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.spec.summary'),
      description: messages.getMessage('flags.spec.description'),
    }),
  };

  public async run(): Promise<AgentCreateResult> {
    const { flags } = await this.parse(AgentCreate);

    this.log(`Creating agent from spec: ${flags.spec}`);

    // POST to /services/data/{api-version}/connect/attach-agent-topics

    // To simulate time spent on the server generating the spec.
    await sleep(Duration.seconds(5));

    return { isSuccess: true };
  }
}
