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
import { ApiCatalog, type McpAgentScriptActionsOutput, type McpServerAssetOutput } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.asset.afscript');

export type ApiCatalogMcpServerAssetAfscriptResult = McpAgentScriptActionsOutput;

const TOOL_PREFIX = 'McpTool__';

// An 18-char record id with a correct checksum names the same record as its first 15 chars, so both
// forms key by the 15-char form. Any other value (a wrong checksum included) keys as is and matches nothing new.
const CHECKSUM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
export const idKey = (id: string): string => {
  if (!/^[a-zA-Z0-9]{18}$/.test(id)) return id;
  const id15 = id.slice(0, 15);
  const checksum = [0, 5, 10]
    .map((start) => {
      let bits = 0;
      for (let i = 0; i < 5; i++) if (/[A-Z]/.test(id15[start + i])) bits |= 1 << i;
      return CHECKSUM_CHARS[bits];
    })
    .join('');
  return checksum === id.slice(15).toUpperCase() ? id15 : id;
};

// The Connect API reports failures through the error name (jsforce sets name to the error code;
// SfError.wrap keeps it); the message always carries the API text.
const errorKind = (error: unknown): 'badRequest' | 'forbidden' | 'notFound' | 'other' => {
  const name = (error as { name?: string })?.name ?? '';
  if (/FORBIDDEN|FUNCTIONALITY_NOT_ENABLED|INSUFFICIENT_ACCESS|ERROR_HTTP_403/i.test(name)) return 'forbidden';
  if (/BAD_REQUEST|ERROR_HTTP_400/i.test(name)) return 'badRequest';
  if (/NOT_FOUND|ERROR_HTTP_404/i.test(name)) return 'notFound';
  return 'other';
};

// Agentforce Builder places action blocks at 8 spaces (subagent actions:) and reasoning entries at 12
// (subagent reasoning: actions:). The API returns them flush left; --json keeps the raw strings.
const indent = (text: string, n: number): string =>
  text
    .split('\n')
    .map((line) => (line.trim() ? ' '.repeat(n) + line : line))
    .join('\n');

export default class ApiCatalogMcpServerAssetAfscript extends SfCommand<ApiCatalogMcpServerAssetAfscriptResult> {
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
    tool: Flags.string({
      summary: messages.getMessage('flags.tool.summary'),
      char: 't',
      multiple: true,
    }),
    'asset-id': Flags.string({
      summary: messages.getMessage('flags.asset-id.summary'),
      multiple: true,
    }),
  };

  public async run(): Promise<ApiCatalogMcpServerAssetAfscriptResult> {
    const { flags } = await this.parse(ApiCatalogMcpServerAssetAfscript);
    const tools = flags.tool ?? [];
    const assetIds = flags['asset-id'] ?? [];
    if (tools.length === 0 && assetIds.length === 0) {
      throw new SfError(messages.getMessage('error.noSelection'), 'NoToolSelected', [], 1);
    }
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let assets: McpServerAssetOutput[];
    try {
      assets = (await ApiCatalog.listMcpServerAssets(connection, flags['mcp-server-id'])).assets ?? [];
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.listFailed', [wrapped.message]),
        'ListMcpServerAssetsFailed',
        [],
        4,
        wrapped
      );
    }

    // Request order: every --tool in the order given, then every --asset-id in the order given.
    const mcpTools = assets.filter((a) => a.kind === 'MCP_TOOL');
    const selected: McpServerAssetOutput[] = [];
    const missing = new Set<string>();
    for (const tool of tools) {
      const name = tool.startsWith(TOOL_PREFIX) ? tool : `${TOOL_PREFIX}${tool}`;
      const asset = mcpTools.find((a) => a.name === name);
      if (asset) selected.push(asset);
      else missing.add(tool);
    }
    for (const id of assetIds) {
      const asset = mcpTools.find((a) => idKey(a.id) === idKey(id));
      if (asset) selected.push(asset);
      else missing.add(id);
    }
    // Some orgs omit `active` from asset list; only an explicit false blocks. The API rejects a tool with no GenAiFunction.
    const inactive = [...new Set(selected.filter((a) => a.active === false).map((a) => a.name))];
    if (missing.size > 0 || inactive.length > 0) {
      const available = mcpTools.map((a) => a.name).join(', ');
      const key = ((): string => {
        if (missing.size > 0 && inactive.length > 0) return 'error.notFoundAndNotAllowlisted';
        return missing.size > 0 ? 'error.toolsNotFound' : 'error.notAllowlisted';
      })();
      const tokens = {
        'error.toolsNotFound': [[...missing].join(', '), available],
        'error.notAllowlisted': [inactive.join(', ')],
        'error.notFoundAndNotAllowlisted': [[...missing].join(', '), available, inactive.join(', ')],
      }[key] as string[];
      throw new SfError(
        messages.getMessage(key, tokens),
        missing.size > 0 ? 'ToolNotFound' : 'AssetNotAllowlisted',
        [],
        1
      );
    }
    const toolIds = [...new Set(selected.map((a) => a.id))];

    let result: McpAgentScriptActionsOutput;
    try {
      result = await ApiCatalog.generateMcpAgentScriptActions(connection, toolIds);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      const kind = errorKind(error);
      const key = {
        badRequest: 'error.badRequest',
        forbidden: 'error.forbidden',
        notFound: 'error.notFoundApi',
        other: 'error.failed',
      }[kind];
      throw new SfError(messages.getMessage(key, [wrapped.message]), 'GenerateMcpAgentScriptFailed', [], 4, wrapped);
    }

    if (!this.jsonEnabled()) {
      this.log(
        [
          '# subagent actions:',
          ...result.actions.map((a) => indent(a.actionBlock, 8)),
          '# reasoning actions:',
          ...result.actions.map((a) => indent(a.reasoningReference, 12)),
        ].join('\n')
      );
    }

    return result;
  }
}
