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

import { AgentTest, type AvailableDefinition } from '@salesforce/agents';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.list');

export type AgentTestListResult = AvailableDefinition[];

export default class AgentTestList extends SfCommand<AgentTestListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
  };

  public async run(): Promise<AgentTestListResult> {
    const { flags } = await this.parse(AgentTestList);

    const results = await AgentTest.list(flags['target-org'].getConnection(flags['api-version']));
    this.table({
      data: results,
      columns: [
        { key: 'fullName', name: 'API Name' },
        { key: 'id', name: 'Id' },
        { key: 'createdDate', name: 'Created Date' },
      ],
      sort: { fullName: 'asc' },
    });

    return results;
  }
}
