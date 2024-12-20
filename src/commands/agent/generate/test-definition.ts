/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { input, select } from '@inquirer/prompts';
import { theme } from '../../../inquirer-theme.js';
import { readDir } from '../../../read-dir.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.test-definition');

export default class AgentGenerateTestDefinition extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly state = 'beta';

  public async run(): Promise<void> {
    const testSetDir = join('force-app', 'main', 'default', 'aiEvaluationTestSets');
    const testSets = (await readDir(testSetDir)).map((testSet) => testSet.replace('.aiEvaluationTestSet-meta.xml', ''));
    if (testSets.length === 0) {
      throw new SfError(`No test sets found in ${testSetDir}`, 'NoTestSetsFoundError', [
        'Run the "sf agent generate testset" command to create a test set',
      ]);
    }

    const botsDir = join('force-app', 'main', 'default', 'bots');
    const bots = await readDir(botsDir);
    if (bots.length === 0) {
      throw new SfError(`No agents found in ${botsDir}`, 'NoAgentsFoundError');
    }

    const subjectType = await select<string>({
      message: 'What are you testing',
      choices: ['AGENT'],
      theme,
    });

    const agent = await select<string>({
      message: 'Select the Agent to test',
      choices: bots,
      theme,
    });

    const testSet = await select<string>({
      message: 'Select the test set to use',
      choices: testSets,
      theme,
    });

    const name = await input({
      message: 'Enter a name for the test definition',
      validate: (i: string): string | boolean => (i.length > 0 ? true : 'Name cannot be empty'),
      theme,
    });

    const description = await input({
      message: 'Enter a description for test definition (optional)',
      theme,
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    ${description ? `<description>${description}</description>` : ''}
    <name>${name}</name>
    <subjectType>${subjectType}</subjectType>
    <subjectName>${agent}</subjectName>
    <testSetName>${testSet}</testSetName>
</AiEvaluationDefinition>`;

    // remove all empty lines
    const cleanedXml = xml.replace(/^\s*[\r\n]/gm, '');

    const definitionPath = join(
      'force-app',
      'main',
      'default',
      'aiEvaluationDefinitions',
      `${name}.aiEvaluationDefinition-meta.xml`
    );
    await mkdir(dirname(definitionPath), { recursive: true });
    this.log();
    this.log(`Created ${definitionPath}`);
    await writeFile(definitionPath, cleanedXml);
  }
}
