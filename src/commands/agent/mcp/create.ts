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
  type McpServerCreateOutput,
  type McpServerCreateInput,
  type McpServerAuthorizationInput,
  type McpAuthType,
} from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.create');

export type ApiCatalogMcpServerCreateResult = McpServerCreateOutput;

export default class ApiCatalogMcpServerCreate extends SfCommand<McpServerCreateOutput> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static readonly state = 'preview';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
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
      required: true,
    }),
    'auth-type': Flags.option({
      summary: messages.getMessage('flags.auth-type.summary'),
      options: ['OAUTH', 'NO_AUTH'] as const,
      default: 'NO_AUTH',
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

  public async run(): Promise<McpServerCreateOutput> {
    const { flags } = await this.parse(ApiCatalogMcpServerCreate);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    const authType = flags['auth-type'] as McpAuthType;

    if (authType === 'OAUTH') {
      if (!flags['identity-provider'] || !flags['client-id'] || !flags['client-secret'] || !flags.scope) {
        throw new SfError(messages.getMessage('error.missingOauthFields'), 'MissingOauthFields', [], 1);
      }
    }

    const input: McpServerCreateInput = {
      name: flags.name,
      type: 'EXTERNAL',
      serverUrl: flags['server-url'],
    };

    if (flags.label) {
      input.label = flags.label;
    }

    if (flags.description) {
      input.description = flags.description;
    }

    if (authType === 'OAUTH') {
      const authorization: McpServerAuthorizationInput = {
        authType: 'OAUTH',
        identityProvider: flags['identity-provider']!,
        clientId: flags['client-id']!,
        clientSecret: flags['client-secret']!,
        scope: flags.scope!,
      };
      input.authorization = authorization;
    } else {
      input.authorization = { authType: 'NO_AUTH' };
    }

    let result: McpServerCreateOutput;
    try {
      result = await ApiCatalog.createMcpServer(connection, input);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.failed', [wrapped.message]),
        'CreateMcpServerFailed',
        [],
        4,
        wrapped
      );
    }

    if (!this.jsonEnabled()) {
      this.log(`Created MCP server "${result.server.name}" (${result.server.id}).`);
      this.log(`Discovered ${result.assets.length} asset(s).`);
    }

    return result;
  }
}
