/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Interfaces } from '@oclif/core';
import { Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import select from '@inquirer/select';
import inquirerInput from '@inquirer/input';
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
};

type FlagsOfPrompts<T extends Record<string, FlaggablePrompt>> = Record<
  keyof T,
  Interfaces.OptionFlag<string | undefined, Interfaces.CustomOptions>
>;

export const resultFormatFlag = Flags.option({
  options: ['json', 'human', 'junit', 'tap'] as const,
  default: 'human',
  summary: messages.getMessage('flags.result-format.summary'),
});

export const testOutputDirFlag = Flags.custom<string>({
  char: 'f',
  description: messages.getMessage('flags.output-dir.description'),
  summary: messages.getMessage('flags.output-dir.summary'),
});

export const FLAGGABLE_SPEC_PROMPTS = {
  type: {
    message: messages.getMessage('flags.type.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Type cannot be empty',
    char: 't',
    options: ['customer', 'internal'],
    required: true,
  },
  role: {
    message: messages.getMessage('flags.role.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Role cannot be empty',
    required: true,
  },
  'company-name': {
    message: messages.getMessage('flags.company-name.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Company name cannot be empty',
    required: true,
  },
  'company-description': {
    message: messages.getMessage('flags.company-description.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Company description cannot be empty',
    required: true,
  },
  'company-website': {
    message: messages.getMessage('flags.company-website.summary'),
    validate: (d: string): boolean | string => {
      // Allow empty string
      if (d.length === 0) return true;

      try {
        new URL(d);
        return true;
      } catch (e) {
        return 'Please enter a valid URL';
      }
    },
  },
} satisfies Record<string, FlaggablePrompt>;

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
  const message = flagDef.message.replace(/\.$/, '');
  if (flagDef.options) {
    return select({
      choices: flagDef.options.map((o) => ({ name: o, value: o })),
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
      if (maxTopics > 0) {
        return maxTopics;
      }
    }
    throw messages.createError('error.invalidMaxTopics', [maxTopics]);
  }
};