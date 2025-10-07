/*
 * Copyright 2025, Salesforce, Inc.
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
import { basename, join, relative } from 'node:path';
import { Interfaces } from '@oclif/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages, SfError, SfProject } from '@salesforce/core';
import { camelCaseToTitleCase } from '@salesforce/kit';
import { select, input as inquirerInput } from '@inquirer/prompts';
import autocomplete from 'inquirer-autocomplete-standalone';
import { AgentTest, AgentTestResultsResponse } from '@salesforce/agents';
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

export async function traverseForFiles(dir: string, suffixes: string[], excludeDirs?: string[]): Promise<string[]>;
// eslint-disable-next-line @typescript-eslint/unified-signatures
export async function traverseForFiles(dirs: string[], suffixes: string[], excludeDirs?: string[]): Promise<string[]>;

export async function traverseForFiles(
  dirOrDirs: string | string[],
  suffixes: string[],
  excludeDirs?: string[]
): Promise<string[]> {
  const dirs = Array.isArray(dirOrDirs) ? dirOrDirs : [dirOrDirs];
  const results: string[] = [];

  for (const dir of dirs) {
    // eslint-disable-next-line no-await-in-loop
    const files = await readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = join(dir, file.name);

      if (file.isDirectory() && !excludeDirs?.includes(file.name)) {
        // eslint-disable-next-line no-await-in-loop
        results.push(...(await traverseForFiles(fullPath, suffixes, excludeDirs)));
      } else if (suffixes.some((suffix) => file.name.endsWith(suffix))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export const promptForAiEvaluationDefinitionApiName = async (
  flagDef: FlaggablePrompt,
  connection: Connection
): Promise<string> => {
  const aiDefFiles = await AgentTest.list(connection);

  let id: NodeJS.Timeout;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => {
      reject(new Error('Selection timed out after 30 seconds'));
    }, 30 * 1000).unref();
  });

  return Promise.race([
    autocomplete({
      message: flagDef.message,
      // eslint-disable-next-line @typescript-eslint/require-await
      source: async (input) => {
        const arr = aiDefFiles.map((o) => ({ name: o.fullName, value: o.fullName }));

        if (!input) return arr;
        return arr.filter((o) => o.name.includes(input));
      },
    }),
    timeout,
  ]).then((result) => {
    clearTimeout(id);
    return result as string;
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
  const files = await traverseForFiles(dirsToTraverse, extensions, ['node_modules', ...hiddenDirs]);
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
