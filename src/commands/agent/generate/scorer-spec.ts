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
import { existsSync } from 'node:fs';
import { join, parse } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentScorer } from '@salesforce/agents';
import { warn } from '@oclif/core/errors';
import { theme } from '../../../inquirer-theme.js';
import yesNoOrCancel from '../../../yes-no-cancel.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.scorer-spec');

export function ensureYamlExtension(filePath: string): string {
  const parsedPath = parse(filePath);
  if (parsedPath.ext === '.yaml' || parsedPath.ext === '.yml') return filePath;
  const normalized = `${join(parsedPath.dir, parsedPath.name)}.yaml`;
  warn(`Provided file path does not have a .yaml or .yml extension. Normalizing to ${normalized}`);
  return normalized;
}

async function promptUntilUniqueFile(filePath?: string): Promise<string | undefined> {
  const { input } = await import('@inquirer/prompts');

  const outputFile =
    filePath ??
    (await input({
      message: 'Enter a filepath for the scorer spec file',
      validate(d: string): boolean | string {
        if (!d.length) {
          return 'Path cannot be empty';
        }
        return true;
      },
      theme,
    }));

  const normalized = ensureYamlExtension(outputFile);

  if (!existsSync(normalized)) {
    return normalized;
  }

  const confirmation = await yesNoOrCancel({
    message: `File ${normalized} already exists. Overwrite?`,
    default: false,
  });

  if (confirmation === 'cancel') {
    return;
  }

  if (!confirmation) {
    return promptUntilUniqueFile();
  }

  return normalized;
}

async function determineFilePath(
  outputFile: string | undefined,
  forceOverwrite: boolean,
  name?: string
): Promise<string | undefined> {
  const defaultFile = ensureYamlExtension(outputFile ?? AgentScorer.defaultSpecPath(name ?? 'My_Custom_Scorer'));
  return forceOverwrite ? defaultFile : promptUntilUniqueFile(defaultFile);
}

export default class AgentGenerateScorerSpec extends SfCommand<void> {
  public static state = 'beta';
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;

  public static readonly flags = {
    'output-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.output-file.summary'),
      parse: async (raw): Promise<string> => Promise.resolve(ensureYamlExtension(raw)),
    }),
    'force-overwrite': Flags.boolean({
      summary: messages.getMessage('flags.force-overwrite.summary'),
    }),
    'data-type': Flags.option({
      summary: messages.getMessage('flags.data-type.summary'),
      options: ['Number', 'Text'] as const,
      default: 'Number' as const,
    })(),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
    }),
    'agent-api-name': Flags.string({
      summary: messages.getMessage('flags.agent-api-name.summary'),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AgentGenerateScorerSpec);

    const outputFile = await determineFilePath(flags['output-file'], flags['force-overwrite'], flags['name']);
    if (!outputFile) {
      this.log(messages.getMessage('info.cancel'));
      return;
    }

    await AgentScorer.writeScorerSpecTemplate(outputFile, flags['data-type'], {
      name: flags['name'],
      agentApiName: flags['agent-api-name'],
    });
    this.log(`Created ${outputFile}`);
  }
}
