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
import select from '@inquirer/select';
import confirm from '@inquirer/confirm';
import ansis from 'ansis';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.testset');

type ExpectationType = 'topic_sequence_match' | 'action_sequence_match' | 'bot_response_rating';

export type TestSetInputs = {
  utterance: string;
  expectationType: ExpectationType;
  expectedValue: string;
};

async function promptForTestCase(): Promise<TestSetInputs> {
  const theme = {
    prefix: { idle: ansis.blueBright('?') },
  };
  const utterance = await input({
    message: 'What utterance would you like to test?',
    validate: (d: string): boolean | string => d.length > 0 || 'utterance cannot be empty',
    theme,
  });

  const expectationType = await select<ExpectationType>({
    message: 'What type of expectation would you like to test for the utterance?',
    choices: ['topic_sequence_match', 'action_sequence_match', 'bot_response_rating'],
    theme,
  });

  const expectedValue = await input({
    message: 'What is the expected value for the expectation?',
    validate: (d: string): boolean | string => {
      if (!d.length) {
        return 'expected value cannot be empty';
      }

      if (expectationType === 'action_sequence_match') {
        return d.split(',').length > 1 || 'expected value must be a comma-separated list of actions';
      }

      return true;
    },
    theme,
  });

  return {
    utterance,
    expectationType,
    expectedValue,
  };
}

export function constructTestSetXML(testCases: TestSetInputs[]): string {
  const tab = '  ';
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<AiEvaluationTestSet>\n${tab}<subjectType>AGENT</subjectType>\n`;
  testCases.forEach((testCase, i) => {
    const expectedValue =
      testCase.expectationType === 'action_sequence_match'
        ? `[${testCase.expectedValue
            .split(',')
            .map((v) => `"${v}"`)
            .join(',')}]`
        : testCase.expectedValue;
    xml += `  <testCase>
    <number>${i + 1}</number>
    <inputs>
      <utterance>${testCase.utterance}</utterance>
    </inputs>
    <expectations>
      <expectation>
        <name>${testCase.expectationType}</name>
        <expectedValue>${expectedValue}</expectedValue>
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
