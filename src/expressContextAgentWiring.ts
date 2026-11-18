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

/**
 * Text-level helpers for wiring an Express Context (AEC) retriever action into a local
 * Agent Script (.agent) authoring bundle.
 *
 * The subagent-level `actions:` definition mirrors the platform-generated
 * `<Library>_RetrieverAction` GenAiFunction: it's keyed and sourced by that GenAiFunction's
 * API name, targets `retriever://<retrieverApiName>`, and carries the retriever's full
 * input/output schema. A `reasoning.actions` reference is added so the planner can call it.
 */

export type RetrieverActionInput = {
  subagent: string;
  /** API name of the platform-generated retriever action GenAiFunction; used as the action key and `source`. */
  actionName: string;
  label: string;
  description: string;
  retrieverApiName: string;
};

type Block = { start: number; end: number };

const SUBAGENT_HEADER = /^subagent\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*$/;

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isBlank = (line: string): boolean => line.trim().length === 0;
const quote = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Find the child block of `lines[parent.start]` whose header is `<key>:` at `indent`.
 * The block runs until the next non-blank line indented at or below `indent`.
 */
const findChildBlock = (lines: string[], parent: Block, key: string, indent: number): Block | undefined => {
  for (let i = parent.start + 1; i < parent.end; i++) {
    if (indentOf(lines[i]) === indent && lines[i].trim() === `${key}:`) {
      let end = i + 1;
      while (end < parent.end && (isBlank(lines[end]) || indentOf(lines[end]) > indent)) end++;
      return { start: i, end };
    }
  }
  return undefined;
};

/** Last non-blank line index in a block, so insertions don't land after trailing blank lines. */
const lastContentLine = (lines: string[], block: Block): number => {
  let i = block.end - 1;
  while (i > block.start && isBlank(lines[i])) i--;
  return i;
};

/** Locate a top-level `subagent <name>:` block and the file's indent unit inside it. */
const findSubagent = (lines: string[], name: string): { block: Block; unit: number } | undefined => {
  const start = lines.findIndex((line) => SUBAGENT_HEADER.exec(line)?.[1] === name);
  if (start === -1) return undefined;
  let end = start + 1;
  while (end < lines.length && (isBlank(lines[end]) || indentOf(lines[end]) > 0)) end++;
  // Match the file's indent unit (generated bundles use 4 spaces).
  const firstChild = lines.slice(start + 1, end).find((line) => !isBlank(line));
  return { block: { start, end }, unit: firstChild ? indentOf(firstChild) : 4 };
};

const unquote = (value: string): string =>
  /^"(.*)"$/.test(value) ? value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\') : value;

export type SubagentInfo = {
  /** Developer name from the `subagent <name>:` header. */
  name: string;
  /** Display name from the subagent's `label:`; falls back to `name` when absent. */
  label: string;
};

/** All `subagent <name>:` blocks in the script, in file order, with their display labels. */
export const listSubagents = (script: string): SubagentInfo[] => {
  const lines = script.split(/\r?\n/);
  return lines
    .map((line) => SUBAGENT_HEADER.exec(line)?.[1])
    .filter((name): name is string => name !== undefined)
    .map((name) => {
      const { block, unit } = findSubagent(lines, name)!;
      const labelLine = lines
        .slice(block.start + 1, block.end)
        .find((line) => indentOf(line) === unit && line.trim().startsWith('label:'));
      const label = labelLine ? unquote(labelLine.trim().slice('label:'.length).trim()) : '';
      return { name, label: label || name };
    });
};

const definesAction = (lines: string[], block: Block, unit: number, actionName: string): boolean => {
  const actionsBlock = findChildBlock(lines, block, 'actions', unit);
  return (
    actionsBlock !== undefined &&
    lines
      .slice(actionsBlock.start + 1, actionsBlock.end)
      .some((l) => indentOf(l) === unit * 2 && l.trim() === `${actionName}:`)
  );
};

/** Whether the subagent already defines an action with this name in its `actions:` block. */
export const hasAction = (script: string, subagent: string, actionName: string): boolean => {
  const lines = script.split(/\r?\n/);
  const found = findSubagent(lines, subagent);
  return found !== undefined && definesAction(lines, found.block, found.unit, actionName);
};

/**
 * Return a new script with a retriever action added to the given subagent.
 * Throws if the subagent doesn't exist or already defines an action with that name.
 */
export const addRetrieverAction = (script: string, input: RetrieverActionInput): string => {
  const eol = script.includes('\r\n') ? '\r\n' : '\n';
  const lines = script.split(/\r?\n/);

  const found = findSubagent(lines, input.subagent);
  if (!found) {
    throw new Error(`Subagent "${input.subagent}" was not found in the authoring bundle.`);
  }
  const { block: subagent, unit } = found;
  const pad = (level: number): string => ' '.repeat(unit * level);

  if (definesAction(lines, subagent, unit, input.actionName)) {
    throw new Error(`Subagent "${input.subagent}" already has an action named "${input.actionName}".`);
  }
  const actionsBlock = findChildBlock(lines, subagent, 'actions', unit);

  const inputField = (name: string, type: string, label: string, description: string, required: boolean): string[] => [
    `${pad(4)}${name}: ${type}`,
    `${pad(5)}label: ${quote(label)}`,
    `${pad(5)}description: ${quote(description)}`,
    `${pad(5)}is_required: ${required ? 'True' : 'False'}`,
  ];
  const definition = [
    `${pad(2)}${input.actionName}:`,
    `${pad(3)}description: ${quote(input.description)}`,
    `${pad(3)}label: ${quote(input.label)}`,
    `${pad(3)}source: ${quote(input.actionName)}`,
    `${pad(3)}target: ${quote(`retriever://${input.retrieverApiName}`)}`,
    `${pad(3)}inputs:`,
    ...inputField('searchText', 'string', 'Search Text', 'A string containing general terms for the search.', true),
    ...inputField(
      'resultCount',
      'integer',
      'Result Count',
      '(Optional) The maximum number of top results to return.The default value is 20. For example, if Result Count is set to 5 and there are more than 5 results that meet the specified criteria, then only the top 5 results are returned.',
      false
    ),
    ...inputField(
      'retrievalMode',
      'string',
      'Retrieval Mode',
      'Retrieval mode. Optional, if not specified, default to Basic.',
      false
    ),
    ...inputField(
      'enableCitations',
      'boolean',
      'Citations',
      'Enable or disable citations. Optional, if not specified, default to false.',
      false
    ),
    ...inputField('locale', 'string', 'Locale', 'Optional locale filter', false),
    ...inputField(
      'clientName',
      'string',
      'Client Name',
      '(Optional) Set a unique client name to track activity and usage for the calling client.',
      false
    ),
    ...inputField(
      'clientTraceId',
      'string',
      'Client Trace Id',
      '(Optional) Set a client-defined trace id for tracking the request from the calling client.',
      false
    ),
    `${pad(3)}outputs:`,
    `${pad(4)}results: string`,
    `${pad(5)}label: "Results"`,
    `${pad(
      5
    )}description: "An Apex ConnectApi__MlRetrieverQueryResultRepresentation record that contains the results of the action."`,
    `${pad(5)}is_displayable: False`,
    `${pad(5)}filter_from_agent: False`,
  ];
  const reference = [`${pad(3)}${input.actionName}: @actions.${input.actionName}`, `${pad(4)}with searchText = ...`];

  // Collect insertions as (afterLineIndex, newLines) and apply bottom-up so indices stay valid.
  const insertions: Array<[number, string[]]> = [];

  const reasoning = findChildBlock(lines, subagent, 'reasoning', unit);
  if (reasoning) {
    const reasoningActions = findChildBlock(lines, reasoning, 'actions', unit * 2);
    if (reasoningActions) {
      insertions.push([lastContentLine(lines, reasoningActions), reference]);
    } else {
      insertions.push([lastContentLine(lines, reasoning), [`${pad(2)}actions:`, ...reference]]);
    }
  }

  if (actionsBlock) {
    insertions.push([lastContentLine(lines, actionsBlock), definition]);
  } else {
    insertions.push([lastContentLine(lines, subagent), ['', `${pad(1)}actions:`, ...definition]]);
  }

  if (!reasoning) {
    insertions.push([lastContentLine(lines, subagent), ['', `${pad(1)}reasoning:`, `${pad(2)}actions:`, ...reference]]);
  }

  // Stable sort descending by position; for equal positions keep push order reversed so
  // earlier-pushed content ends up first after splicing.
  insertions
    .map((ins, order) => ({ ins, order }))
    .sort((a, b) => b.ins[0] - a.ins[0] || b.order - a.order)
    .forEach(({ ins: [after, newLines] }) => lines.splice(after + 1, 0, ...newLines));

  return lines.join(eol);
};

/**
 * Library naming for a subagent: master label "<subagent display name> Express", developer name
 * the same label reduced to a valid API name (letters, digits, single underscores, ≤ 80 chars).
 */
export const libraryNameForSubagent = (subagentLabel: string): { masterLabel: string; developerName: string } => {
  const masterLabel = `${subagentLabel.trim()} Express`;
  let developerName = masterLabel.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!/^[A-Za-z]/.test(developerName)) developerName = `X_${developerName}`;
  return { masterLabel, developerName: developerName.slice(0, 80).replace(/_+$/, '') };
};
