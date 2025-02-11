/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError, SfProject } from '@salesforce/core';
import { generateTestSpec } from '@salesforce/agents';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import { XMLParser } from 'fast-xml-parser';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { theme } from '../../../inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.test-spec');

// TODO: add these back once we refine the regex
// export const FORTY_CHAR_API_NAME_REGEX =
//   /^(?=.{1,57}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,39})?$/;
// export const EIGHTY_CHAR_API_NAME_REGEX =
//   /^(?=.{1,97}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,79})?$/;

type TestCase = {
  utterance: string;
  expectedActions: string[];
  expectedTopic: string;
  expectedOutcome: string;
};

function castArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

async function promptForTestCase(genAiPlugins: Record<string, string>): Promise<TestCase> {
  const utterance = await input({
    message: 'Utterance',
    validate: (d: string): boolean | string => d.length > 0 || 'utterance cannot be empty',
    theme,
  });

  const customKey = '<OTHER>';

  const topics = Object.keys(genAiPlugins);

  const askForOtherActions = async (): Promise<string[]> =>
    (
      await input({
        message: 'Expected action(s)',
        validate: (d: string): boolean | string => {
          if (!d.length) {
            return 'expected value cannot be empty';
          }
          return true;
        },
        theme,
      })
    )
      .split(',')
      .map((a) => a.trim());

  const askForOutcome = async (): Promise<string> =>
    input({
      message: 'Expected outcome',
      validate: (d: string): boolean | string => {
        if (!d.length) {
          return 'expected value cannot be empty';
        }

        return true;
      },
      theme,
    });

  const expectedTopic = await select<string>({
    message: 'Expected topic',
    choices: [...topics, customKey],
    theme,
  });

  if (expectedTopic === customKey) {
    return {
      utterance,
      expectedTopic: await input({
        message: 'Expected topic',
        validate: (d: string): boolean | string => {
          if (!d.length) {
            return 'expected value cannot be empty';
          }
          return true;
        },
        theme,
      }),
      // If the user selects OTHER for the topic, then we don't have a genAiPlugin to get actions from so we ask for them for custom input
      expectedActions: await askForOtherActions(),
      expectedOutcome: await askForOutcome(),
    };
  }

  const genAiPluginXml = await readFile(genAiPlugins[expectedTopic], 'utf-8');
  const parser = new XMLParser();
  const parsed = parser.parse(genAiPluginXml) as { GenAiPlugin: { genAiFunctions: Array<{ functionName: string }> } };
  const actions = castArray(parsed.GenAiPlugin.genAiFunctions ?? []).map((f) => f.functionName);

  let expectedActions = await checkbox<string>({
    message: 'Expected action(s)',
    choices: [...actions, customKey],
    theme,
    required: true,
  });

  if (expectedActions.includes(customKey)) {
    const additional = await askForOtherActions();

    expectedActions = [...expectedActions.filter((a) => a !== customKey), ...additional];
  }

  const expectedOutcome = await askForOutcome();

  return {
    utterance,
    expectedTopic,
    expectedActions,
    expectedOutcome,
  };
}

export default class AgentGenerateTestSpec extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly state = 'beta';

  public static readonly flags = {
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'specs',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AgentGenerateTestSpec);
    const directoryPaths = (await SfProject.resolve().then((project) => project.getPackageDirectories())).map(
      (dir) => dir.fullPath
    );

    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['GenAiPlanner', 'GenAiPlugin', 'Bot'],
        directoryPaths,
      },
    });
    const botsComponents = cs.filter((component) => component.type.name === 'Bot');
    const bots = [...botsComponents.map((c) => c.fullName).filter((n) => n !== '*')];
    if (bots.length === 0) {
      throw new SfError(`No agents found in ${directoryPaths.join(', ')}`, 'NoAgentsFoundError');
    }

    const subjectType = await select<string>({
      message: 'What are you testing',
      choices: ['AGENT'],
      theme,
    });

    const subjectName = await select<string>({
      message: 'Select the Agent to test',
      choices: bots,
      theme,
    });

    const genAiPlanners = [
      ...cs.filter((component) => component.type.name === 'GenAiPlanner' && component.fullName !== '*'),
    ].reduce<Record<string, string>>(
      (acc, component) => ({
        ...acc,
        [component.fullName]: cs.getComponentFilenamesByNameAndType({
          fullName: component.fullName,
          type: 'GenAiPlanner',
        })[0],
      }),
      {}
    );

    const plannerXml = await readFile(genAiPlanners[subjectName], 'utf-8');
    const parser = new XMLParser();
    const parsed = parser.parse(plannerXml) as { GenAiPlanner: { genAiPlugins: Array<{ genAiPluginName: string }> } };

    const genAiPlugins = parsed.GenAiPlanner.genAiPlugins.reduce(
      (acc, { genAiPluginName }) => ({
        ...acc,
        [genAiPluginName]: cs.getComponentFilenamesByNameAndType({
          fullName: genAiPluginName,
          type: 'GenAiPlugin',
        })[0],
      }),
      {}
    );

    const name = await input({
      message: 'Enter a name for the test definition',
      validate(d: string): boolean | string {
        // ensure that it's not empty
        if (!d.length) {
          return 'Name cannot be empty';
        }

        return true;

        // TODO: add back validation once we refine the regex
        // check against FORTY_CHAR_API_NAME_REGEX
        // if (!FORTY_CHAR_API_NAME_REGEX.test(d)) {
        //   return 'The non-namespaced portion an API name must begin with a letter, contain only letters, numbers, and underscores, not contain consecutive underscores, and not end with an underscore.';
        // }
        // return true;
      },
      theme,
    });

    const description = await input({
      message: 'Enter a description for test definition (optional)',
      theme,
    });

    const testCases = [];
    do {
      this.log();
      this.styledHeader(`Adding test case #${testCases.length + 1}`);
      // eslint-disable-next-line no-await-in-loop
      testCases.push(await promptForTestCase(genAiPlugins));
    } while ( // eslint-disable-next-line no-await-in-loop
      await confirm({
        message: 'Would you like to add another test case',
        default: true,
      })
    );

    this.log();

    const outputFile = join(flags['output-dir'], `${subjectName}-test-spec.yaml`);

    if (existsSync(outputFile)) {
      await this.confirm({ message: `File ${outputFile} already exists. Overwrite?`, defaultAnswer: false });
    }

    await generateTestSpec(
      {
        name,
        description,
        subjectType,
        subjectName,
        testCases,
      },
      outputFile
    );
    this.log(`Created ${outputFile}`);
  }
}
