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

import { readdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { Interfaces } from '@oclif/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages, SfError, SfProject } from '@salesforce/core';
import { camelCaseToTitleCase } from '@salesforce/kit';
import { select, input as inquirerInput } from '@inquirer/prompts';
import autocomplete from 'inquirer-autocomplete-standalone';
import {
  AgentTest,
  AgentTestResultsResponse,
  type ContextVariable,
  type ContextVariableType,
} from '@salesforce/agents';
import { theme } from './inquirer-theme.js';
import { AgentTestResultsResult } from './commands/agent/test/results.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'shared');

export type AgentTestRunResult =
  | (Partial<AgentTestResultsResponse> & { status: 'NEW' | 'IN_PROGRESS' | 'ERROR' | 'TERMINATED'; runId: string })
  | (AgentTestResultsResult & { status: 'COMPLETED'; runId: string });

export type FlaggablePrompt = {
  message: string;
  options?: readonly string[] | string[];
  validate: (d: string) => boolean | string;
  char?: Interfaces.AlphabetLowercase | Interfaces.AlphabetUppercase;
  required?: boolean;
  default?: string | boolean;
  promptMessage?: string;
};

type FlagsOfPrompts<T extends Record<string, FlaggablePrompt>> = Record<
  keyof T,
  Interfaces.OptionFlag<string | undefined, Interfaces.CustomOptions>
>;

type AgentTone = 'casual' | 'formal' | 'neutral';

export const resultFormatFlag = Flags.option({
  options: ['json', 'human', 'junit', 'tap'] as const,
  default: 'human',
  summary: messages.getMessage('flags.result-format.summary'),
});

export const testOutputDirFlag = Flags.custom<string>({
  char: 'd',
  description: messages.getMessage('flags.output-dir.description'),
  summary: messages.getMessage('flags.output-dir.summary'),
});

export const verboseFlag = Flags.boolean({
  summary: messages.getMessage('flags.verbose.summary'),
  description: messages.getMessage('flags.verbose.description'),
});

export const testRunnerFlag = Flags.custom<'agentforce-studio' | 'testing-center'>({
  options: ['agentforce-studio', 'testing-center'],
  summary: messages.getMessage('flags.test-runner.summary'),
  description: messages.getMessage('flags.test-runner.description'),
})();

export const contextVariablesFlag = Flags.string({
  multiple: true,
  delimiter: ',',
  summary: messages.getMessage('flags.context-variables.summary'),
  description: messages.getMessage('flags.context-variables.description'),
});

/**
 * JSON form of --context-variables that carries the variable's type, so callers can
 * send Boolean/Number/Object/List/Json values (not just Text). Deliberately has no
 * `delimiter`, so a comma inside the JSON (or inside a List/Object value) is safe.
 */
export const contextVariablesJsonFlag = Flags.string({
  summary: messages.getMessage('flags.context-variables-json.summary'),
  description: messages.getMessage('flags.context-variables-json.description'),
});

// The valid ContextVariable.type values, mirroring the preview API's Variable schema.
const CONTEXT_VARIABLE_TYPES: readonly ContextVariableType[] = [
  'Text',
  'Date',
  'DateTime',
  'Money',
  'Ref',
  'Boolean',
  'Number',
  'Object',
  'List',
  'Json',
];

// Types whose `value` is a plain string on the wire.
const STRING_CONTEXT_VARIABLE_TYPES: readonly ContextVariableType[] = ['Text', 'Date', 'DateTime', 'Money', 'Ref'];

function describeJsonValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/**
 * Validates that a decoded JSON `value` matches its declared `type`, matching the
 * preview API's per-type Variable schema (Boolean->boolean, Number->number,
 * string types->string, Object/List->array, Json->object). `value` is optional and
 * nullable, so undefined/null pass.
 */
function validateContextVariableValue(name: string, type: ContextVariableType, value: unknown): void {
  if (value === undefined || value === null) return;
  const reject = (expected: string): never => {
    throw new SfError(
      `Invalid --context-variables-json: variable "${name}" of type "${type}" expects ${expected}, but got ${describeJsonValue(
        value
      )}.`
    );
  };
  if (type === 'Boolean' && typeof value !== 'boolean') reject('a boolean value');
  else if (type === 'Number' && typeof value !== 'number') reject('a number value');
  else if (STRING_CONTEXT_VARIABLE_TYPES.includes(type) && typeof value !== 'string') reject('a string value');
  else if ((type === 'Object' || type === 'List') && !Array.isArray(value)) reject('an array value');
  else if (type === 'Json' && (typeof value !== 'object' || Array.isArray(value))) reject('a JSON object value');
}

function toContextVariable(entry: unknown, index: number): ContextVariable {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new SfError(
      `Invalid --context-variables-json: entry at index ${index} must be an object with "name" and "type" (and optionally "value").`
    );
  }
  const { name, type, value } = entry as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new SfError(`Invalid --context-variables-json: entry at index ${index} is missing a non-empty "name".`);
  }
  if (typeof type !== 'string' || !CONTEXT_VARIABLE_TYPES.includes(type as ContextVariableType)) {
    throw new SfError(
      `Invalid --context-variables-json: variable "${name}" has invalid type "${String(
        type
      )}". Expected one of: ${CONTEXT_VARIABLE_TYPES.join(', ')}.`
    );
  }
  validateContextVariableValue(name, type as ContextVariableType, value);
  return { name, type, value } as ContextVariable;
}

const CONTEXT_VARIABLES_JSON_EXAMPLE = '[{"name":"probeGate","type":"Boolean","value":true}]';

/**
 * Parses the --context-variables-json flag: a JSON array of typed context variables
 * ({ name, type, value }) matching the preview API's Variable schema. Throws an
 * SfError with a specific reason on malformed JSON, a non-array, or a bad entry.
 */
export function parseContextVariablesJson(raw: string | undefined): ContextVariable[] {
  if (raw === undefined || raw.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SfError(
      `Invalid --context-variables-json: value is not valid JSON. Expected a JSON array, e.g. ${CONTEXT_VARIABLES_JSON_EXAMPLE}.`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new SfError(
      `Invalid --context-variables-json: expected a JSON array, e.g. ${CONTEXT_VARIABLES_JSON_EXAMPLE}.`
    );
  }
  return parsed.map(toContextVariable);
}

/**
 * Merges the text-form (--context-variables) and JSON-form (--context-variables-json)
 * context variables into one array. When the same name appears in both, the JSON entry
 * wins, keeping the text entry's original position.
 */
export function mergeContextVariables(
  textVariables: ContextVariable[],
  jsonVariables: ContextVariable[]
): ContextVariable[] {
  const byName = new Map<string, ContextVariable>();
  for (const variable of textVariables) byName.set(variable.name, variable);
  for (const variable of jsonVariables) byName.set(variable.name, variable);
  return [...byName.values()];
}

/**
 * Parses raw "Name=Value" entries from --context-variables into ContextVariable
 * objects for the SDK. Type is always "Text"; to send a typed variable
 * (Boolean/Number/Object/List/Json) use --context-variables-json instead.
 *
 * Names pass through verbatim. The runtime distinguishes two namespaces by name
 * shape: "$Context.<Name>" for linked context variables, bare "<developerName>"
 * for mutable state variables. The CLI does not transform either.
 */
export function parseContextVariables(raw: string[] | undefined): ContextVariable[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((entry) => {
    const eq = entry.indexOf('=');
    if (eq === -1) {
      throw new SfError(`Invalid --context-variables: ${entry}. Expected Name=Value.`);
    }
    const name = entry.slice(0, eq).trim();
    const value = entry.slice(eq + 1);
    if (!name) {
      throw new SfError(`Invalid --context-variables: ${entry}. Name cannot be empty.`);
    }
    return { name, type: 'Text', value };
  });
}

function validateInput(input: string, validate: (input: string) => boolean | string): never | string {
  const result = validate(input);
  if (typeof result === 'string') throw new Error(result);
  return input;
}

export function makeFlags<T extends Record<string, FlaggablePrompt>>(flaggablePrompts: T): FlagsOfPrompts<T> {
  return Object.fromEntries(
    Object.entries(flaggablePrompts).map(([key, value]) => [
      key,
      Flags.string({
        summary: value.message,
        options: value.options,
        char: value.char,
        // eslint-disable-next-line @typescript-eslint/require-await
        async parse(input) {
          return validateInput(input, value.validate);
        },
        // NOTE: we purposely omit the required property here because we want to allow the flag to be missing in interactive mode
      }),
    ])
  ) as FlagsOfPrompts<T>;
}

export async function getHiddenDirs(projectRoot?: string): Promise<string[]> {
  const rootDir = projectRoot ?? process.cwd();

  try {
    const files = await readdir(rootDir, { withFileTypes: true });
    return files.filter((file) => file.isDirectory() && file.name.startsWith('.')).map((file) => file.name);
  } catch (error) {
    return [];
  }
}

export function traverseForFiles(dir: string, suffixes: string[], excludeDirs?: string[]): string[];
// eslint-disable-next-line @typescript-eslint/unified-signatures
export function traverseForFiles(dirs: string[], suffixes: string[], excludeDirs?: string[]): string[];

export function traverseForFiles(dirOrDirs: string | string[], suffixes: string[], excludeDirs?: string[]): string[] {
  const dirs = Array.isArray(dirOrDirs) ? dirOrDirs : [dirOrDirs];
  const results: string[] = [];

  for (const dir of dirs) {
    const files = readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = join(dir, file.name);

      if (file.isDirectory() && !excludeDirs?.includes(file.name)) {
        results.push(...traverseForFiles(fullPath, suffixes, excludeDirs));
      } else if (suffixes.some((suffix) => file.name.toLowerCase().endsWith(suffix.toLowerCase()))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export type TestDefinitionSelection = {
  apiName: string;
  testRunner?: 'agentforce-studio' | 'testing-center';
};

export const promptForTestDefinitionApiName = async (
  flagDef: FlaggablePrompt,
  connection: Connection
): Promise<TestDefinitionSelection> => {
  const aiDefFiles = await AgentTest.list(connection);

  const duplicateNames = new Set(
    aiDefFiles
      .filter((o, i) => aiDefFiles.some((other, j) => i !== j && o.fullName === other.fullName))
      .map((o) => o.fullName)
  );

  // Map each entry to a value that encodes the runner type for duplicates
  const choicesByValue = new Map(
    aiDefFiles.map((o) => {
      const runner: 'agentforce-studio' | 'testing-center' =
        o.type === 'AiEvaluationDefinition' ? 'testing-center' : 'agentforce-studio';
      const valueKey = duplicateNames.has(o.fullName) ? `${o.fullName}::${runner}` : o.fullName;
      return [valueKey, { apiName: o.fullName, testRunner: duplicateNames.has(o.fullName) ? runner : undefined }];
    })
  );

  let id: NodeJS.Timeout;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => {
      reject(new Error('Selection timed out after 30 seconds'));
    }, 30 * 1000).unref();
  });

  return Promise.race([
    autocomplete({
      message: flagDef.promptMessage ?? flagDef.message,
      // eslint-disable-next-line @typescript-eslint/require-await
      source: async (input) => {
        const arr = [...choicesByValue.entries()].map(([valueKey, { apiName, testRunner }]) => ({
          name: testRunner ? `${apiName} (${testRunner})` : apiName,
          value: valueKey,
        }));

        if (!input) return arr;
        return arr.filter((o) => o.name.includes(input));
      },
    }),
    timeout,
  ]).then((valueKey) => {
    clearTimeout(id);
    return choicesByValue.get(valueKey as string) ?? { apiName: valueKey as string };
  });
};

export const promptForFileByExtensions = async (
  flagDef: FlaggablePrompt,
  extensions: string[],
  fileNameOnly = false,
  dirs?: string[]
): Promise<string> => {
  const hiddenDirs = await getHiddenDirs();
  const dirsToTraverse = dirs ?? [process.cwd()];
  const files = traverseForFiles(dirsToTraverse, extensions, ['node_modules', ...hiddenDirs]);
  return autocomplete({
    message: flagDef.promptMessage ?? flagDef.message.replace(/\.$/, ''),
    // eslint-disable-next-line @typescript-eslint/require-await
    source: async (input) => {
      let arr;
      if (fileNameOnly) {
        arr = files.map((o) => ({ name: basename(o).split('.')[0], value: basename(o).split('.')[0] }));
      } else {
        arr = files.map((o) => ({ name: relative(process.cwd(), o), value: o }));
      }
      if (!input) return arr;
      return arr.filter((o) => o.name.includes(input));
    },
  });
};

export const promptForYamlFile = async (flagDef: FlaggablePrompt): Promise<string> =>
  promptForFileByExtensions(flagDef, ['.yml', '.yaml']);

export const promptForSpecYaml = async (flagDef: FlaggablePrompt): Promise<string | undefined> => {
  const hiddenDirs = await getHiddenDirs();
  const dirsToTraverse = [process.cwd()];
  const files = traverseForFiles(dirsToTraverse, ['AgentSpec.yml', 'AgentSpec.yaml'], ['node_modules', ...hiddenDirs]);
  return autocomplete({
    message: flagDef.promptMessage ?? flagDef.message.replace(/\.$/, ''),
    // eslint-disable-next-line @typescript-eslint/require-await
    source: async (input) => {
      const arr = [
        ...files.map((o) => ({ name: relative(process.cwd(), o), value: o })),
        { name: 'Default Agent Spec', value: undefined },
      ];

      if (!input) return arr;
      return arr.filter((o) => o.name.includes(input));
    },
  });
};

export const promptForFlag = async (flagDef: FlaggablePrompt): Promise<string> => {
  const message = flagDef.promptMessage ?? flagDef.message.replace(/\.$/, '');
  if (flagDef.options) {
    return select<string>({
      choices: flagDef.options.map((o) => ({ name: camelCaseToTitleCase(o), value: o })),
      message,
      theme,
    });
  }

  return inquirerInput({
    message,
    validate: flagDef.validate,
    theme,
  });
};

export const promptForAgentFiles = (project: SfProject, flagDef: FlaggablePrompt): Promise<string> => {
  const dirs = project.getPackageDirectories().map((dir) => dir.fullPath);
  return promptForFileByExtensions(flagDef, ['.bundle-meta.xml'], true, dirs);
};

export const validateAgentType = (agentType?: string, required = false): string | undefined => {
  if (required && !agentType) {
    throw messages.createError('error.invalidAgentType', [agentType]);
  }
  if (agentType) {
    if (!['customer', 'internal'].includes(agentType.trim())) {
      throw messages.createError('error.invalidAgentType', [agentType]);
    }
    return agentType.trim();
  }
};

export const validateMaxTopics = (maxTopics?: number): number | undefined => {
  // Deliberately using: != null
  if (maxTopics != null) {
    if (!isNaN(maxTopics) && isFinite(maxTopics)) {
      if (maxTopics > 0 && maxTopics < 31) {
        return maxTopics;
      }
    }
    throw messages.createError('error.invalidMaxTopics', [maxTopics]);
  }
};

export const validateTone = (tone: AgentTone): AgentTone => {
  if (!['formal', 'casual', 'neutral'].includes(tone)) {
    throw messages.createError('error.invalidTone', [tone]);
  }
  return tone;
};

export const validateAgentUser = async (connection: Connection, agentUser?: string): Promise<void> => {
  if (agentUser?.length) {
    try {
      const q = `SELECT Id FROM User WHERE Username = '${agentUser}'`;
      await connection.singleRecordQuery<{ Id: string }>(q);
    } catch (error) {
      const err = SfError.wrap(error);
      throw SfError.create({
        name: 'InvalidAgentUser',
        message: messages.getMessage('error.invalidAgentUser', [agentUser]),
        cause: err,
      });
    }
  }
};

export const getAgentUserId = async (connection: Connection, agentUser: string): Promise<string> => {
  const q = `SELECT Id FROM User WHERE Username = '${agentUser}'`;
  return (await connection.singleRecordQuery<{ Id: string }>(q)).Id;
};
