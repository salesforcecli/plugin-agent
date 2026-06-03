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
import { Messages, SfError } from '@salesforce/core';
import { AgentDataLibrary, type DataLibrarySummary } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.adl.list');

export type AgentAdlListResult = { libraries: DataLibrarySummary[] };

export default class AgentAdlList extends SfCommand<AgentAdlListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static readonly state = 'preview';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'source-type': Flags.option({
      summary: messages.getMessage('flags.source-type.summary'),
      options: ['sfdrive', 'knowledge', 'retriever'] as const,
    })(),
  };

  public async run(): Promise<AgentAdlListResult> {
    const { flags } = await this.parse(AgentAdlList);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: { libraries: DataLibrarySummary[] };
    try {
      result = await AgentDataLibrary.list(connection, {
        sourceType: flags['source-type'],
      });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.listFailed', [wrapped.message]), 'ListFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: result.libraries,
        columns: [
          { key: 'masterLabel', name: 'Name' },
          { key: 'libraryId', name: 'Library ID' },
          { key: 'sourceType', name: 'Source Type' },
          { key: 'status', name: 'Status' },
          { key: 'developerName', name: 'Developer Name' },
        ],
      });
    }

    return result;
  }
}
