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
import { readFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import {
  ApiCatalog,
  type McpServerAssetCollection,
  type McpServerAssetReplaceInput,
  type McpServerAssetReplaceItem,
} from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.asset.replace');

export type ApiCatalogMcpServerAssetReplaceResult = McpServerAssetCollection;

export default class ApiCatalogMcpServerAssetReplace extends SfCommand<ApiCatalogMcpServerAssetReplaceResult> {
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
    'assets-file': Flags.file({
      summary: messages.getMessage('flags.assets-file.summary'),
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<ApiCatalogMcpServerAssetReplaceResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerAssetReplace);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    const raw = readFileSync(flags['assets-file'], 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SfError(messages.getMessage('error.invalidJson'), 'InvalidJson', [], 1);
    }

    const assets = (
      Array.isArray(parsed) ? parsed : (parsed as { assets?: McpServerAssetReplaceItem[] }).assets
    ) as McpServerAssetReplaceItem[] | undefined;
    if (!assets || !Array.isArray(assets)) {
      throw new SfError(messages.getMessage('error.invalidShape'), 'InvalidShape', [], 1);
    }

    const input: McpServerAssetReplaceInput = { assets };

    let result: McpServerAssetCollection;
    try {
      result = await ApiCatalog.replaceMcpServerAssets(connection, flags['mcp-server-id'], input);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'ReplaceMcpServerAssetsFailed',
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
        })),
        columns: [
          { key: 'id', name: 'ID' },
          { key: 'name', name: 'Name' },
          { key: 'kind', name: 'Kind' },
          { key: 'active', name: 'Active' },
        ],
      });
    }

    return result;
  }
}
