/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import { XMLParser } from 'fast-xml-parser';
import { theme } from '../../../inquirer-theme.js';
import { readDir } from '../../../read-dir.js';
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.test-cases');

// TODO: add these back once we refine the regex
// export const FORTY_CHAR_API_NAME_REGEX =
//   /^(?=.{1,57}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,39})?$/;
// export const EIGHTY_CHAR_API_NAME_REGEX =
//   /^(?=.{1,97}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,79})?$/;

export type TestSetInputs = {
  utterance: string;
  actionSequenceExpectedValue: string[];
  botRatingExpectedValue: string;
  topicSequenceExpectedValue: string;
};

function castArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

async function promptForTestCase(genAiPlugins: Record<string, string>): Promise<TestSetInputs> {
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

  const askForBotRating = async (): Promise<string> =>
    input({
      message: 'Expected response',
      validate: (d: string): boolean | string => {
        if (!d.length) {
          return 'expected value cannot be empty';
        }

        return true;
      },
      theme,
    });

  const topicSequenceExpectedValue = await select<string>({
    message: 'Expected topic',
    choices: [...topics, customKey],
    theme,
  });

  if (topicSequenceExpectedValue === customKey) {
    return {
      utterance,
      topicSequenceExpectedValue: await input({
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
      actionSequenceExpectedValue: await askForOtherActions(),
      botRatingExpectedValue: await askForBotRating(),
    };
  }

  const genAiPluginXml = await readFile(genAiPlugins[topicSequenceExpectedValue], 'utf-8');
  const parser = new XMLParser();
  const parsed = parser.parse(genAiPluginXml) as { GenAiPlugin: { genAiFunctions: Array<{ functionName: string }> } };
  const actions = castArray(parsed.GenAiPlugin.genAiFunctions).map((f) => f.functionName);

  let actionSequenceExpectedValue = await checkbox<string>({
    message: 'Expected action(s)',
    choices: [...actions, customKey],
    theme,
    required: true,
  });

  if (actionSequenceExpectedValue.includes(customKey)) {
    const additional = await askForOtherActions();

    actionSequenceExpectedValue = [...actionSequenceExpectedValue.filter((a) => a !== customKey), ...additional];
  }

  const botRatingExpectedValue = await askForBotRating();

  return {
    utterance,
    actionSequenceExpectedValue,
    botRatingExpectedValue,
    topicSequenceExpectedValue,
  };
}

export function constructTestSetXML(testCases: TestSetInputs[]): string {
  const tab = '  ';
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<AiEvaluationTestSet>\n${tab}<subjectType>AGENT</subjectType>\n`;
  testCases.forEach((testCase, i) => {
    xml += `  <testCase>
    <number>${i + 1}</number>
    <inputs>
      <utterance>${testCase.utterance}</utterance>
    </inputs>
    <expectation>
      <name>topic_sequence_match</name>
      <expectedValue>${testCase.topicSequenceExpectedValue}</expectedValue>
    </expectation>
    <expectation>
      <name>action_sequence_match</name>
      <expectedValue>${`[${testCase.actionSequenceExpectedValue.map((v) => `"${v}"`).join(',')}]`}</expectedValue>
    </expectation>
    <expectation>
      <name>bot_response_rating</name>
      <expectedValue>${testCase.botRatingExpectedValue}</expectedValue>
    </expectation>
  </testCase>\n`;
  });
  xml += '</AiEvaluationTestSet>';
  return xml;
}

export default class AgentGenerateTestCases extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly state = 'beta';

  public async run(): Promise<void> {
    const testSetName = await input({
      message: 'What is the name of this set of test cases',

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
    });

    const genAiPluginDir = join('force-app', 'main', 'default', 'genAiPlugins');
    const genAiPlugins = Object.fromEntries(
      (await readDir(genAiPluginDir)).map((genAiPlugin) => [
        genAiPlugin.replace('.genAiPlugin-meta.xml', ''),
        join(genAiPluginDir, genAiPlugin),
      ])
    );

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

    const testSetPath = join(
      'force-app',
      'main',
      'default',
      'aiEvaluationTestSets',
      `${testSetName}.aiEvaluationTestSet-meta.xml`
    );
    await mkdir(dirname(testSetPath), { recursive: true });
    this.log();
    this.log(`Created ${testSetPath}`);
    await writeFile(testSetPath, constructTestSetXML(testCases));
  }
}
