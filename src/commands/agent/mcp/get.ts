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
import { ApiCatalog, type McpServerOutput } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.get');

export type ApiCatalogMcpServerGetResult = McpServerOutput;

export default class ApiCatalogMcpServerGet extends SfCommand<ApiCatalogMcpServerGetResult> {
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

  public async run(): Promise<ApiCatalogMcpServerGetResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerGet);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: McpServerOutput;
    try {
      result = await ApiCatalog.getMcpServer(connection, flags['mcp-server-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'GetMcpServerFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.log(`Id:        ${result.id}`);
      this.log(`Name:      ${result.name}`);
      this.log(`Label:     ${result.label ?? ''}`);
      this.log(`Type:      ${result.type}`);
      this.log(`Status:    ${result.status}`);
      this.log(`Server URL: ${result.serverUrl ?? ''}`);
    }

    return result;
  }
}
