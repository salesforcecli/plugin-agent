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
import { ApiCatalog, type McpServerAssetCollection } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.asset.list');

export type ApiCatalogMcpServerAssetListResult = McpServerAssetCollection;

export default class ApiCatalogMcpServerAssetList extends SfCommand<ApiCatalogMcpServerAssetListResult> {
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

  public async run(): Promise<ApiCatalogMcpServerAssetListResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerAssetList);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: McpServerAssetCollection;
    try {
      result = await ApiCatalog.listMcpServerAssets(connection, flags['mcp-server-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'ListMcpServerAssetsFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.table({
        data: (result.assets ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          active: a.active,
          availableAsAgentAction: a.availableAsAgentAction,
        })),
        columns: [
          { key: 'id', name: 'ID' },
          { key: 'name', name: 'Name' },
          { key: 'kind', name: 'Kind' },
          { key: 'active', name: 'Active' },
          { key: 'availableAsAgentAction', name: 'Agent Action' },
        ],
      });
    }

    return result;
  }
}
