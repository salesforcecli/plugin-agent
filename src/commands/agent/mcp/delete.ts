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
import { ApiCatalog } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.delete');

export type ApiCatalogMcpServerDeleteResult = { id: string; deleted: boolean };

export default class ApiCatalogMcpServerDelete extends SfCommand<ApiCatalogMcpServerDeleteResult> {
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
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      default: false,
    }),
  };

  public async run(): Promise<ApiCatalogMcpServerDeleteResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerDelete);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    // Skip the confirmation prompt in JSON mode — scripted/CI callers cannot answer it.
    if (!flags['no-prompt'] && !this.jsonEnabled()) {
      const confirmed = await this.confirm({
        message: messages.getMessage('confirm.delete', [flags['mcp-server-id']]),
      });
      if (!confirmed) {
        throw new SfError(messages.getMessage('error.aborted'), 'Aborted', [], 1);
      }
    }

    try {
      await ApiCatalog.deleteMcpServer(connection, flags['mcp-server-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'DeleteMcpServerFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.log(`Deleted MCP server ${flags['mcp-server-id']}.`);
    }

    return { id: flags['mcp-server-id'], deleted: true };
  }
}
