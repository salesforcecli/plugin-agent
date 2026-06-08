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
import {
  ApiCatalog,
  type McpServerOutput,
  type McpServerUpdateInput,
  type McpServerAuthorizationInput,
  type McpAuthType,
} from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.update');

export type ApiCatalogMcpServerUpdateResult = McpServerOutput;

export default class ApiCatalogMcpServerUpdate extends SfCommand<ApiCatalogMcpServerUpdateResult> {
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
    label: Flags.string({
      summary: messages.getMessage('flags.label.summary'),
    }),
    description: Flags.string({
      summary: messages.getMessage('flags.description.summary'),
    }),
    'server-url': Flags.string({
      summary: messages.getMessage('flags.server-url.summary'),
    }),
    'auth-type': Flags.option({
      summary: messages.getMessage('flags.auth-type.summary'),
      options: ['OAUTH', 'NO_AUTH'] as const,
    })(),
    'identity-provider': Flags.string({
      summary: messages.getMessage('flags.identity-provider.summary'),
    }),
    'client-id': Flags.string({
      summary: messages.getMessage('flags.client-id.summary'),
    }),
    'client-secret': Flags.string({
      summary: messages.getMessage('flags.client-secret.summary'),
      allowStdin: true,
    }),
    scope: Flags.string({
      summary: messages.getMessage('flags.scope.summary'),
    }),
  };

  public async run(): Promise<ApiCatalogMcpServerUpdateResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerUpdate);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    const input: McpServerUpdateInput = {};

    if (flags.label !== undefined) {
      input.label = flags.label;
    }

    if (flags.description !== undefined) {
      input.description = flags.description;
    }

    if (flags['server-url'] !== undefined) {
      input.serverUrl = flags['server-url'];
    }

    const authType = flags['auth-type'] as McpAuthType | undefined;

    if (authType) {
      if (authType === 'OAUTH') {
        if (
          !flags['identity-provider'] ||
          !flags['client-id'] ||
          !flags['client-secret'] ||
          !flags.scope
        ) {
          throw new SfError(messages.getMessage('error.missingOauthFields'), 'MissingOauthFields', [], 1);
        }

        const authorization: McpServerAuthorizationInput = {
          authType: 'OAUTH',
          identityProvider: flags['identity-provider'],
          clientId: flags['client-id'],
          clientSecret: flags['client-secret'],
          scope: flags.scope,
        };
        input.authorization = authorization;
      } else {
        const authorization: McpServerAuthorizationInput = { authType: 'NO_AUTH' };
        input.authorization = authorization;
      }
    }

    if (Object.keys(input).length === 0) {
      throw new SfError(messages.getMessage('error.noFields'), 'NoFields', [], 1);
    }

    let result: McpServerOutput;
    try {
      result = await ApiCatalog.updateMcpServer(connection, flags['mcp-server-id'], input);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'UpdateMcpServerFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.log(`Updated MCP server "${result.label ?? result.name}" (${result.id}).`);
    }

    return result;
  }
}
