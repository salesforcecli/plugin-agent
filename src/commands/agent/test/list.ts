/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AgentTester, type AvailableDefinition } from '@salesforce/agents';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.list');

export type AgentTestListResult = AvailableDefinition[];

export default class AgentTestList extends SfCommand<AgentTestListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<AgentTestListResult> {
    const { flags } = await this.parse(AgentTestList);

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const results = await agentTester.list();
    this.table({
      data: results,
      columns: [
        { key: 'fullName', name: 'Name' },
        { key: 'id', name: 'Id' },
        { key: 'createdDate', name: 'Created Date' },
      ],
      sort: { fullName: 'asc' },
    });

    return results;
  }
}
