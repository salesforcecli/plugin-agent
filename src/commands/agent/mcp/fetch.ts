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
import { ApiCatalog, type McpServerFetchOutput } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.fetch');

export type ApiCatalogMcpServerFetchResult = McpServerFetchOutput;

export default class ApiCatalogMcpServerFetch extends SfCommand<ApiCatalogMcpServerFetchResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static readonly state = 'preview';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'mcp-server-id': Flags.string({
      summary: messages.getMessage('flags.mcp-server-id.summary'),
      char: 'i',
      required: true,
    }),
  };

  public async run(): Promise<ApiCatalogMcpServerFetchResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerFetch);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: McpServerFetchOutput;
    try {
      result = await ApiCatalog.fetchMcpServer(connection, flags['mcp-server-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'FetchMcpServerFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: (result.assets ?? []).map((a) => ({
          name: a.name,
          kind: a.kind,
          status: a.status,
          active: a.active,
          availableAsAgentAction: a.availableAsAgentAction,
        })),
        columns: [
          { key: 'name', name: 'Name' },
          { key: 'kind', name: 'Kind' },
          { key: 'status', name: 'Status' },
          { key: 'active', name: 'Active' },
          { key: 'availableAsAgentAction', name: 'Agent Action' },
        ],
      });
    }

    return result;
  }
}
