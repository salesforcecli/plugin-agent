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
import input from '@inquirer/input';
import confirm from '@inquirer/confirm';
import { theme } from '../../../inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.testset');

export type TestSetInputs = {
  utterance: string;
  actionSequenceExpectedValue: string;
  botRatingExpectedValue: string;
  topicSequenceExpectedValue: string;
};

async function promptForTestCase(): Promise<TestSetInputs> {
  const utterance = await input({
    message: 'What utterance would you like to test?',
    validate: (d: string): boolean | string => d.length > 0 || 'utterance cannot be empty',
    theme,
  });

  const topicSequenceExpectedValue = await input({
    message: 'What is the expected value for the topic expectation?',
    validate: (d: string): boolean | string => {
      if (!d.length) {
        return 'expected value cannot be empty';
      }
      return true;
    },
    theme,
  });

  const actionSequenceExpectedValue = await input({
    message: 'What is the expected value for the action expectation?',
    validate: (d: string): boolean | string => {
      if (!d.length) {
        return 'expected value cannot be empty';
      }
      return true;
    },
    theme,
  });

  const botRatingExpectedValue = await input({
    message: 'What is the expected value for the bot rating expectation?',
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
        <expectedValue>${`[${testCase.actionSequenceExpectedValue
          .split(',')
          .map((v) => `"${v}"`)
          .join(',')}]`}</expectedValue>
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
      message: 'What is the name of the test set?',
    });
    const testCases = [];
    do {
      this.log();
      this.styledHeader(`Adding test case #${testCases.length + 1}`);
      // eslint-disable-next-line no-await-in-loop
      testCases.push(await promptForTestCase());
    } while ( // eslint-disable-next-line no-await-in-loop
      await confirm({
        message: 'Would you like to add another test case?',
        default: true,
      })
    );

    const testSetPath = join('force-app', 'main', 'default', 'aiEvaluationTestsets', `${testSetName}.xml`);
    await mkdir(dirname(testSetPath), { recursive: true });
    this.log();
    this.log(`Writing new AiEvaluationTestSet to ${testSetPath}`);
    await writeFile(testSetPath, constructTestSetXML(testCases));
  }
}
