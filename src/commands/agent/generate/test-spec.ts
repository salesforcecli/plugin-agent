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
import { ComponentSet, ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { theme } from '../../../inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.test-spec');

type TestCase = {
  utterance: string;
  expectedActions: string[];
  expectedTopic: string;
  expectedOutcome: string;
};

function castArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Prompts the user for test case information through interactive prompts.
 *
 * @param genAiPlugins - Record mapping topic names to GenAiPlugin XML file paths (used to find the related actions)
 * @param genAiFunctions - Array of GenAiFunction names from the GenAiPlanner
 * @returns Promise resolving to a TestCase object containing:
 * - utterance: The user input string
 * - expectedTopic: The expected topic for classification
 * - expectedActions: Array of expected action names
 * - expectedOutcome: Expected outcome string
 *
 * @remarks
 * This function guides users through creating a test case by:
 * 1. Prompting for an utterance
 * 2. Selecting an expected topic (from GenAiPlugins specified in the Bot's GenAiPlanner)
 * 3. Choosing expected actions (from GenAiFunctions in the GenAiPlanner or GenAiPlugin)
 * 4. Defining an expected outcome
 */
async function promptForTestCase(genAiPlugins: Record<string, string>, genAiFunctions: string[]): Promise<TestCase> {
  const utterance = await input({
    message: 'Utterance',
    validate: (d: string): boolean | string => d.length > 0 || 'utterance cannot be empty',
    theme,
  });

  const expectedTopic = await select<string>({
    message: 'Expected topic',
    choices: Object.keys(genAiPlugins),
    theme,
  });

  // GenAiFunctions (aka actions) can be defined in the GenAiPlugin or GenAiPlanner
  // the actions from the planner are passed in as an argument to this function
  // the actions from the plugin are read from the GenAiPlugin file
  let actions: string[] = [];
  if (genAiPlugins[expectedTopic]) {
    const genAiPluginXml = await readFile(genAiPlugins[expectedTopic], 'utf-8');
    const parser = new XMLParser();
    const parsed = parser.parse(genAiPluginXml) as { GenAiPlugin: { genAiFunctions: Array<{ functionName: string }> } };
    actions = castArray(parsed.GenAiPlugin.genAiFunctions ?? []).map((f) => f.functionName);
  }

  const expectedActions = await checkbox<string>({
    message: 'Expected action(s)',
    choices: [...actions, ...genAiFunctions],
    theme,
    required: true,
  });

  const expectedOutcome = await input({
    message: 'Expected outcome',
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
    expectedTopic,
    expectedActions,
    expectedOutcome,
  };
}

/**
 * Retrieves GenAIPlugins and GenAiFunctions from a Bot's GenAiPlanner
 *
 * We have to get the bot version and planner for the selected bot so that we can get
 * the actions (GenAiFunctions) and topics (GenAiPlugins) that can be selected for the
 * test cases.
 *
 * The BotVersion tells us which GenAiPlanner to use, and the GenAiPlanner
 * tells us which GenAiPlugins and GenAiFunctions are available. More GenAiFunctions
 * might be available in the GenAiPlugin, so we read those later when the user
 * has selected a GenAiPlugin/topic - inside of `promptForTestCase`.
 *
 * @param subjectName - The name of the Bot to analyze
 * @param cs - ComponentSet containing Bot, GenAiPlanner, and GenAiPlugin components
 *
 * @returns Object containing:
 * - genAiPlugins: Record of plugin names to their file paths
 * - genAiFunctions: Array of function names
 */
async function getPluginsAndFunctions(
  subjectName: string,
  cs: ComponentSet
): Promise<{
  genAiPlugins: Record<string, string>;
  genAiFunctions: string[];
}> {
  const botVersions = [...cs.filter((component) => component.type.name === 'Bot' && component.fullName !== '*')].reduce<
    Record<string, string>
  >(
    (acc, component) => ({
      ...acc,
      // this resolves to the BotVersion filepath
      [component.fullName]: cs.getComponentFilenamesByNameAndType({
        fullName: component.fullName,
        type: 'Bot',
      })[0],
    }),
    {}
  );

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

  const parser = new XMLParser();
  const botVersionXml = await readFile(botVersions[subjectName], 'utf-8');
  const parsedBotVersion = parser.parse(botVersionXml) as {
    BotVersion: { conversationDefinitionPlanners: { genAiPlannerName: string } };
  };

  const plannerXml = await readFile(
    genAiPlanners[parsedBotVersion.BotVersion.conversationDefinitionPlanners.genAiPlannerName ?? subjectName],
    'utf-8'
  );
  const parsedPlanner = parser.parse(plannerXml) as {
    GenAiPlanner: {
      genAiPlugins: Array<{ genAiPluginName: string }>;
      genAiFunctions: Array<{ genAiFunctionName: string }>;
    };
  };

  const genAiFunctions = castArray(parsedPlanner.GenAiPlanner.genAiFunctions).map(
    ({ genAiFunctionName }) => genAiFunctionName
  );

  const genAiPlugins = castArray(parsedPlanner.GenAiPlanner.genAiPlugins).reduce(
    (acc, { genAiPluginName }) => ({
      ...acc,
      [genAiPluginName]: cs.getComponentFilenamesByNameAndType({
        fullName: genAiPluginName,
        type: 'GenAiPlugin',
      })[0],
    }),
    {}
  );

  return { genAiPlugins, genAiFunctions };
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

    const { genAiPlugins, genAiFunctions } = await getPluginsAndFunctions(subjectName, cs);

    const name = await input({
      message: 'Enter a name for the test definition',
      validate(d: string): boolean | string {
        // ensure that it's not empty
        if (!d.length) {
          return 'Name cannot be empty';
        }

        return true;
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
      testCases.push(await promptForTestCase(genAiPlugins, genAiFunctions));
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
