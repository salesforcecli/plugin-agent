/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'shared');

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
