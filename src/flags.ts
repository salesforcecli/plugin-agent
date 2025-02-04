/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Interfaces } from '@oclif/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { Connection, Messages, SfError } from '@salesforce/core';
import { camelCaseToTitleCase } from '@salesforce/kit';
import { select, input as inquirerInput } from '@inquirer/prompts';
import { theme } from './inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'shared');

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
