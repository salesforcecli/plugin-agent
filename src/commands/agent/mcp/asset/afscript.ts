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
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError, SfProject } from '@salesforce/core';
import {
  Agent,
  ApiCatalog,
  findAuthoringBundle,
  McpAgentScript,
  type McpAgentScriptActionOutput,
  type McpAgentScriptActionsOutput,
  type McpServerAssetOutput,
} from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.mcp.asset.afscript');

export type SubagentUpdate = { name: string; added: string[]; skipped: string[] };

export type ApiCatalogMcpServerAssetAfscriptResult = McpAgentScriptActionsOutput & {
  bundle?: { name: string; file: string; subagents: SubagentUpdate[] };
};

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

const leading = (line: string): number => line.length - line.trimStart().length;

// End of the section that starts at `header`: the first later non-blank line at `depth` spaces or less (or `end`).
const sectionEnd = (lines: string[], header: number, depth: number, end: number): number => {
  for (let i = header + 1; i < end; i++) if (lines[i].trim() && leading(lines[i]) <= depth) return i;
  return end;
};

// Index after the last non-blank line in [from, to), so new lines go before trailing blank lines.
const afterLastContent = (lines: string[], from: number, to: number): number => {
  let at = from;
  for (let i = from; i < to; i++) if (lines[i].trim()) at = i + 1;
  return at;
};

// Index of the line that is exactly `header` (trailing spaces ignored) in [from, to), or -1.
const findHeader = (lines: string[], header: string, from: number, to: number): number => {
  for (let i = from; i < to; i++) if (lines[i].trimEnd() === header) return i;
  return -1;
};

const keyOf = (line: string): string => line.trim().match(/^(\S+):/)?.[1] ?? '';

/**
 * Adds each action block under the subagent's `actions:` (8 spaces) and each reasoning reference under its
 * `reasoning:` > `actions:` (12 spaces), the places Agentforce Builder uses. Creates a missing section. Skips an
 * action whose key is already in the subagent's actions, so a second run changes nothing.
 */
export const addToSubagent = (
  content: string,
  subagent: string,
  actions: Array<Pick<McpAgentScriptActionOutput, 'name' | 'actionBlock' | 'reasoningReference'>>
): { content: string; added: string[]; skipped: string[] } => {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => [`subagent ${subagent}:`, `start_agent ${subagent}:`].includes(l.trimEnd()));
  if (start < 0) {
    const names = lines.map((l) => l.trimEnd().match(/^(?:subagent|start_agent) (\S+):$/)?.[1]).filter(Boolean);
    throw new SfError(
      messages.getMessage('error.subagentNotFound', [subagent, names.join(', ')]),
      'SubagentNotFound',
      [],
      1
    );
  }
  const blockEnd = (): number => sectionEnd(lines, start, 0, lines.length);
  const keysAt = (from: number, to: number, depth: number): Set<string> =>
    new Set(
      lines
        .slice(from, to)
        .filter((l) => l.trim() && leading(l) === depth)
        .map(keyOf)
    );

  // Subagent actions: header at 4 spaces, blocks at 8.
  let header = findHeader(lines, '    actions:', start + 1, blockEnd());
  if (header < 0) {
    header = afterLastContent(lines, start, blockEnd());
    lines.splice(header, 0, '    actions:');
  }
  const existing = keysAt(header + 1, sectionEnd(lines, header, 4, blockEnd()), 8);
  const added = actions.filter((a) => !existing.has(a.name));
  const skipped = actions.filter((a) => existing.has(a.name)).map((a) => a.name);
  if (added.length === 0) return { content, added: [], skipped };
  const blocksAt = afterLastContent(lines, header, sectionEnd(lines, header, 4, blockEnd()));
  lines.splice(blocksAt, 0, ...added.flatMap((a) => indent(a.actionBlock, 8).split('\n')));

  // Reasoning actions: reasoning at 4 spaces, its actions at 8, references at 12.
  let reasoning = findHeader(lines, '    reasoning:', start + 1, blockEnd());
  if (reasoning < 0) {
    reasoning = afterLastContent(lines, start, blockEnd());
    lines.splice(reasoning, 0, '    reasoning:');
  }
  const reasoningEnd = (): number => sectionEnd(lines, reasoning, 4, blockEnd());
  let refHeader = findHeader(lines, '        actions:', reasoning + 1, reasoningEnd());
  if (refHeader < 0) {
    refHeader = afterLastContent(lines, reasoning, reasoningEnd());
    lines.splice(refHeader, 0, '        actions:');
  }
  const refs = keysAt(refHeader + 1, sectionEnd(lines, refHeader, 8, reasoningEnd()), 12);
  const refsAt = afterLastContent(lines, refHeader, sectionEnd(lines, refHeader, 8, reasoningEnd()));
  lines.splice(
    refsAt,
    0,
    ...added.filter((a) => !refs.has(a.name)).flatMap((a) => indent(a.reasoningReference, 12).split('\n'))
  );
  return { content: lines.join(eol), added: added.map((a) => a.name), skipped };
};

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
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      dependsOn: ['subagent'],
    }),
    subagent: Flags.string({
      summary: messages.getMessage('flags.subagent.summary'),
      multiple: true,
      dependsOn: ['authoring-bundle'],
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
      result = await McpAgentScript.generateActions(connection, toolIds);
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

    const bundleName = flags['authoring-bundle'];
    if (bundleName) {
      return {
        ...result,
        bundle: await this.updateBundle(connection, bundleName, flags.subagent ?? [], result.actions),
      };
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

  /** Adds the actions to each subagent of the local bundle, then compiles it; restores the file if compile fails. */
  private async updateBundle(
    connection: Parameters<typeof McpAgentScript.generateActions>[0],
    name: string,
    subagents: string[],
    actions: McpAgentScriptActionOutput[]
  ): Promise<NonNullable<ApiCatalogMcpServerAssetAfscriptResult['bundle']>> {
    let project: SfProject;
    try {
      project = this.project ?? (await SfProject.resolve());
    } catch (error) {
      throw new SfError(messages.getMessage('error.notInProject'), 'NotInProject', [], 1, SfError.wrap(error));
    }
    const dir = findAuthoringBundle(
      project.getPackageDirectories().map((p) => p.fullPath),
      name
    );
    if (!dir) throw new SfError(messages.getMessage('error.bundleNotFound', [name]), 'AuthoringBundleNotFound', [], 1);
    const file = join(dir, `${name}.agent`);

    const original = await readFile(file, 'utf8');
    let content = original;
    const updates: SubagentUpdate[] = [];
    for (const subagent of [...new Set(subagents)]) {
      const r = addToSubagent(content, subagent, actions);
      content = r.content;
      updates.push({ name: subagent, added: r.added, skipped: r.skipped });
    }
    for (const s of updates) {
      this.log(
        messages.getMessage('info.subagentUpdated', [s.name, s.added.join(', ') || '-', s.skipped.join(', ') || '-'])
      );
    }
    if (content === original) return { name, file, subagents: updates };

    await writeFile(file, content, 'utf8');
    const compiled = await (await Agent.init({ connection, project, aabName: name })).compile();
    if (compiled.status !== 'success') {
      await writeFile(file, original, 'utf8');
      const errors = compiled.errors
        .map((e) => `${e.errorType}: ${e.description} [Ln ${e.lineStart}, Col ${e.colStart}]`)
        .join('\n');
      throw new SfError(messages.getMessage('error.compileFailed', [file, errors]), 'AgentScriptCompileFailed', [], 1);
    }
    this.log(messages.getMessage('info.bundleUpdated', [file]));
    return { name, file, subagents: updates };
  }
}
