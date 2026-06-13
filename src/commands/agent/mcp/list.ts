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
import { ApiCatalog, type McpServerCollection } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.list');

export type ApiCatalogMcpServerListResult = McpServerCollection;

export default class ApiCatalogMcpServerList extends SfCommand<ApiCatalogMcpServerListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static readonly state = 'preview';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    label: Flags.string({
      summary: messages.getMessage('flags.label.summary'),
    }),
    type: Flags.option({
      summary: messages.getMessage('flags.type.summary'),
      options: ['EXTERNAL'] as const,
    })(),
    status: Flags.option({
      summary: messages.getMessage('flags.status.summary'),
      options: ['ACTIVE', 'DISCONNECTED'] as const,
    })(),
  };

  public async run(): Promise<ApiCatalogMcpServerListResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerList);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: McpServerCollection;
    try {
      result = await ApiCatalog.listMcpServers(connection, {
        label: flags.label,
        type: flags.type,
        status: flags.status,
      });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'ListMcpServersFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: result.mcpServers ?? [],
        columns: [
          { key: 'id', name: 'ID' },
          { key: 'name', name: 'Name' },
          { key: 'label', name: 'Label' },
          { key: 'type', name: 'Type' },
          { key: 'status', name: 'Status' },
          { key: 'serverUrl', name: 'Server URL' },
        ],
      });
    }

    return result;
  }
}
