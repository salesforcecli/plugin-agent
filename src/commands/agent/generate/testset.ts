/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import { theme } from '../../../inquirer-theme.js';
import { readDir } from '../../../read-dir.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.testset');

export const FORTY_CHAR_API_NAME_REGEX =
  /^(?=.{1,57}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,39})?$/;
export const EIGHTY_CHAR_API_NAME_REGEX =
  /^(?=.{1,97}$)[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,14}(__[a-zA-Z]([a-zA-Z0-9]|_(?!_)){0,79})?$/;

export type TestSetInputs = {
  utterance: string;
  actionSequenceExpectedValue: string[];
  botRatingExpectedValue: string;
  topicSequenceExpectedValue: string;
};

async function promptForTestCase({ topics, actions }: { topics: string[]; actions: string[] }): Promise<TestSetInputs> {
  const utterance = await input({
    message: 'Utterance',
    validate: (d: string): boolean | string => d.length > 0 || 'utterance cannot be empty',
    theme,
  });

  const customKey = '<OTHER>';

  let topicSequenceExpectedValue = await select<string>({
    message: 'Expected topic',
    choices: [...topics, customKey],
    theme,
  });

  if (topicSequenceExpectedValue === customKey) {
    topicSequenceExpectedValue = await input({
      message: 'Expected topic',
      validate: (d: string): boolean | string => {
        if (!d.length) {
          return 'expected value cannot be empty';
        }
        return true;
      },
      theme,
    });
  }

  let actionSequenceExpectedValue = await checkbox<string>({
    message: 'Expected action(s)',
    choices: [...actions, customKey],
    theme,
    required: true,
  });

  if (actionSequenceExpectedValue.includes(customKey)) {
    const additional = (
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

    actionSequenceExpectedValue = [...actionSequenceExpectedValue.filter((a) => a !== customKey), ...additional];
  }

  const botRatingExpectedValue = await input({
    message: 'Expected response',
    validate: (d: string): boolean | string => {
      if (!d.length) {
        return 'expected value cannot be empty';
      }

      return true;
    },
    theme,
  });

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
    <expectations>
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
    </expectations>
  </testCase>\n`;
  });
  xml += '</AiEvaluationTestSet>';
  return xml;
}

export default class AgentGenerateTestset extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly state = 'beta';

  public async run(): Promise<void> {
    const testSetName = await input({
      message: 'What is the name of the test set',
      validate(d: string): boolean | string {
        // check against FORTY_CHAR_API_NAME_REGEX
        if (!FORTY_CHAR_API_NAME_REGEX.test(d)) {
          return 'The non-namespaced portion an API name must begin with a letter, contain only letters, numbers, and underscores, not contain consecutive underscores, and not end with an underscore.';
        }
        return true;
      },
    });

    const genAiPluginDir = join('force-app', 'main', 'default', 'genAiPlugins');
    const genAiPlugins = (await readDir(genAiPluginDir)).map((genAiPlugin) =>
      genAiPlugin.replace('.genAiPlugin-meta.xml', '')
    );

    const genAiFunctionsDir = join('force-app', 'main', 'default', 'genAiFunctions');
    const genAiFunctions = (await readDir(genAiFunctionsDir)).map((genAiFunction) =>
      genAiFunction.replace('.genAiFunction-meta.xml', '')
    );

    const testCases = [];
    do {
      this.log();
      this.styledHeader(`Adding test case #${testCases.length + 1}`);
      // eslint-disable-next-line no-await-in-loop
      testCases.push(await promptForTestCase({ topics: genAiPlugins, actions: genAiFunctions }));
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
