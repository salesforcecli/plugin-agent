/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import select from '@inquirer/select';
import input from '@inquirer/input';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.definition');

export default class AgentGenerateDefinition extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly state = 'beta';

  public async run(): Promise<void> {
    const testSetDir = join('force-app', 'main', 'default', 'aiEvaluationTestSets');
    const testSets = (await readdir(testSetDir)).map((testSet) => testSet.replace('.xml', ''));
    if (testSets.length === 0) {
      throw new SfError(`No test sets found in ${testSetDir}`, 'NoTestSetsFoundError', [
        'Run the "sf agent generate testset" command to create a test set',
      ]);
    }

    const botsDir = join('force-app', 'main', 'default', 'bots');
    const bots = await readdir(botsDir);
    if (bots.length === 0) {
      throw new SfError(`No bots found in ${botsDir}`, 'NoBotsFoundError');
    }

    const testSet = await select<string>({
      message: 'Select the AiEvaluationTestSet to use',
      choices: testSets,
    });

    const bot = await select<string>({
      message: 'Select the Bot to run the tests against',
      choices: bots,
    });

    const name = await input({
      message: 'Enter a name for the AiEvaluationDefinition',
      validate: (i: string): string | boolean => (i.length > 0 ? true : 'Name cannot be empty'),
    });

    const description = await input({
      message: 'Enter a description for the AiEvaluationDefinition',
    });

    const subjectType = await select<string>({
      message: 'Select the type for the AiEvaluationDefinition',
      choices: ['AGENT'],
    });

    this.log(`Generating AiEvaluationDefinition for ${bot} using ${testSet} AiEvaluationTestSet`);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    ${description ? `<description>${description}</description>` : ''}
    <name>${name}</name>
    <subjectType>${subjectType}</subjectType>
    <subjectName>${bot}</subjectName>
    <testSetName>${testSet}</testSetName>
</AiEvaluationDefinition>`;

    // remove all empty lines
    const cleanedXml = xml.replace(/^\s*[\r\n]/gm, '');

    const definitionPath = join('force-app', 'main', 'default', 'aiEvaluationDefinitions', `${name}.xml`);
    await mkdir(dirname(definitionPath), { recursive: true });
    this.log(`Writing AiEvaluationDefinition to ${definitionPath}`);
    await writeFile(definitionPath, cleanedXml);
  }
}
