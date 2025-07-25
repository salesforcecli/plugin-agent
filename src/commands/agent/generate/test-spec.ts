/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import { join, parse } from 'node:path';
import { existsSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError, SfProject } from '@salesforce/core';
import { AgentTest } from '@salesforce/agents';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import { XMLParser } from 'fast-xml-parser';
import { ComponentSet, ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { warn } from '@oclif/core/errors';
import { ensureArray } from '@salesforce/kit';
import { theme } from '../../../inquirer-theme.js';
import yesNoOrCancel from '../../../yes-no-cancel.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.test-spec');

type TestCase = {
  utterance: string;
  expectedActions: string[];
  expectedTopic: string;
  expectedOutcome: string;
  customEvaluations?: Array<{
    label: string;
    name: string;
    parameters: Array<
      | { name: 'operator'; value: string; isReference: false }
      | { name: 'actual'; value: string; isReference: true }
      | { name: 'expected'; value: string; isReference: boolean }
    >;
  }>;
};

/**
 * Prompts the user for test case information through interactive prompts.
 *
 * @param genAiPlugins - Record mapping topic names to GenAiPlugin XML file paths (used to find the related actions)
 * @param genAiFunctions - Array of GenAiFunction names from the GenAiPlannerBundle
 * @returns Promise resolving to a TestCase object containing:
 * - utterance: The user input string
 * - expectedTopic: The expected topic for classification
 * - expectedActions: Array of expected action names
 * - expectedOutcome: Expected outcome string
 * - customEvaluations: Optional array of custom evaluation JSONpaths, names, and required information for metadata
 *
 * @remarks
 * This function guides users through creating a test case by:
 * 1. Prompting for an utterance
 * 2. Selecting an expected topic (from GenAiPlugins specified in the Bot's GenAiPlannerBundle)
 * 3. Choosing expected actions (from GenAiFunctions in the GenAiPlannerBundle or GenAiPlugin)
 * 4. Defining an expected outcome
 * 5. Optional array of custom evaluation JSONpaths, names, and required information for metadata
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

  // GenAiFunctions (aka actions) can be defined in the GenAiPlugin or GenAiPlannerBundle
  // the actions from the planner are passed in as an argument to this function
  // the actions from the plugin are read from the GenAiPlugin file
  let actions: string[] = [];
  if (genAiPlugins[expectedTopic]) {
    const genAiPluginXml = await fs.promises.readFile(genAiPlugins[expectedTopic], 'utf-8');
    const parser = new XMLParser();
    const parsed = parser.parse(genAiPluginXml) as { GenAiPlugin: { genAiFunctions: Array<{ functionName: string }> } };
    actions = ensureArray(parsed.GenAiPlugin.genAiFunctions ?? []).map((f) => f.functionName);
  }

  const expectedActions = (
    await checkbox<string | null>({
      message: 'Expected action(s)',
      choices: [
        { name: 'No Actions', value: null },
        ...actions.concat(genAiFunctions).map((a) => ({ name: a, value: a })),
      ],
      theme,
      validate: (choices) => {
        if (choices.find((c) => c.name === 'No Actions')?.checked && choices.length > 1) {
          // "no actions" selected, and other actions selected
          // returns as the error message to the user
          return 'Cannot select "No Actions" and other Actions';
        }
        return true;
      },
      required: true,
    })
  )
    // remove the 'No Actions', null entry to produce "expectedActions: []" in spec.yaml
    .filter((f) => f !== null);

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

  const customEvaluations = await promptForCustomEvaluations();

  return {
    utterance,
    expectedTopic,
    expectedActions,
    expectedOutcome,
    customEvaluations,
  };
}

/**
 * Creates a custom evaluation object with the provided parameters
 *
 * @param label - Descriptive label for the evaluation
 * @param jsonPath - JSONPath for the actual value
 * @param operator - Comparison operator
 * @param expectedValue - Expected value to compare against
 * @returns Custom evaluation object in the expected format
 */
export function createCustomEvaluation(
  label: string,
  jsonPath: string,
  operator: string,
  expectedValue: string
): NonNullable<TestCase['customEvaluations']>[0] {
  return {
    label,
    name:
      !isNaN(Number(expectedValue)) && !isNaN(parseFloat(expectedValue)) ? 'numeric_comparison' : 'string_comparison',
    parameters: [
      { name: 'operator', value: operator, isReference: false },
      { name: 'actual', value: jsonPath, isReference: true },
      { name: 'expected', value: expectedValue, isReference: false },
    ],
  };
}

export async function promptForCustomEvaluations(): Promise<NonNullable<TestCase['customEvaluations']>> {
  const customEvaluations: NonNullable<TestCase['customEvaluations']> = [];
  let wantsCustomEvaluation = await confirm({
    message: 'Do you want to add a custom evaluation',
    default: false,
    theme,
  });

  // we can have multiple custom evaluations, prompt until the user is done
  while (wantsCustomEvaluation) {
    // eslint-disable-next-line no-await-in-loop
    const label = await input({
      message: 'Custom evaluation label (descriptive name)',
      validate: (d: string): boolean | string => {
        if (!d.length) {
          return 'Label cannot be empty';
        }
        return true;
      },
      theme,
    });

    // eslint-disable-next-line no-await-in-loop
    const jsonPath = await input({
      message: 'Custom evaluation JSONPath (starts with $)',
      validate: (d: string): boolean | string => {
        if (!d.length) {
          return 'JSONPath cannot be empty';
        }
        if (!d.startsWith('$')) {
          return 'JSONPath must start with $';
        }
        return true;
      },
      theme,
    });

    // eslint-disable-next-line no-await-in-loop
    const operator = await select<string>({
      message: 'Comparison operator',
      choices: [
        { name: 'Equals ', value: 'equals' },
        { name: 'Greater than or equals (>=)', value: 'greater_than_or_equal' },
        { name: 'Greater than (>)', value: 'greater_than' },
        { name: 'Less than (<)', value: 'less_than' },
        { name: 'Less than or equals (<=)', value: 'less_than_or_equal' },
      ],
      theme,
    });

    // eslint-disable-next-line no-await-in-loop
    const expectedValue = await input({
      message: 'Expected value',
      validate: (d: string): boolean | string => {
        if (!d.length) {
          return 'Expected value cannot be empty';
        }
        return true;
      },
      theme,
    });

    customEvaluations.push(createCustomEvaluation(label, jsonPath, operator, expectedValue));

    // eslint-disable-next-line no-await-in-loop
    wantsCustomEvaluation = await confirm({
      message: 'Do you want to add another custom evaluation',
      default: false,
      theme,
    });
  }

  return customEvaluations;
}

export function getMetadataFilePaths(cs: ComponentSet, type: string): Record<string, string> {
  return [...cs.filter((component) => component.type.name === type && component.fullName !== '*')].reduce<
    Record<string, string>
  >(
    (acc, component) => ({
      ...acc,
      [component.fullName]: cs.getComponentFilenamesByNameAndType({
        fullName: component.fullName,
        type,
      })[0],
    }),
    {}
  );
}

/**
 * Retrieves GenAIPlugins and GenAiFunctions from a Bot's GenAiPlannerBundle
 *
 * We have to get the bot version and planner for the selected bot so that we can get
 * the actions (GenAiFunctions) and topics (GenAiPlugins) that can be selected for the
 * test cases.
 *
 * The BotVersion tells us which GenAiPlannerBundle to use, and the GenAiPlannerBundle
 * tells us which GenAiPlugins and GenAiFunctions are available. More GenAiFunctions
 * might be available in the GenAiPlugin, so we read those later when the user
 * has selected a GenAiPlugin/topic - inside of `promptForTestCase`.
 *
 * @param subjectName - The name of the Bot to analyze
 * @param cs - ComponentSet containing Bot, GenAiPlannerBundle, and GenAiPlugin components
 *
 * @returns Object containing:
 * - genAiPlugins: Record of plugin names to their file paths
 * - genAiFunctions: Array of function names
 */
export async function getPluginsAndFunctions(
  subjectName: string,
  cs: ComponentSet
): Promise<{
  genAiPlugins: Record<string, string>;
  genAiFunctions: string[];
}> {
  const botVersions = getMetadataFilePaths(cs, 'Bot');
  let genAiFunctions: string[] = [];
  let genAiPlugins: Record<string, string> = {};

  const parser = new XMLParser();
  const botVersionXml = await fs.promises.readFile(botVersions[subjectName], 'utf-8');
  const parsedBotVersion = parser.parse(botVersionXml) as {
    BotVersion: { conversationDefinitionPlanners: { genAiPlannerName: string } };
  };

  try {
    // if the users still have genAiPlanner, not the bundle, we can work with that
    const genAiPlanners = getMetadataFilePaths(cs, 'GenAiPlanner');

    const plannerXml = await fs.promises.readFile(
      genAiPlanners[parsedBotVersion.BotVersion.conversationDefinitionPlanners.genAiPlannerName ?? subjectName],
      'utf-8'
    );
    const parsedPlanner = parser.parse(plannerXml) as {
      GenAiPlanner: {
        genAiPlugins: Array<{ genAiPluginName: string }>;
        genAiFunctions: Array<{ genAiFunctionName: string }>;
      };
    };
    genAiFunctions = ensureArray(parsedPlanner.GenAiPlanner.genAiFunctions).map(
      ({ genAiFunctionName }) => genAiFunctionName
    );

    genAiPlugins = ensureArray(parsedPlanner.GenAiPlanner.genAiPlugins).reduce(
      (acc, { genAiPluginName }) => ({
        ...acc,
        [genAiPluginName]: cs.getComponentFilenamesByNameAndType({
          fullName: genAiPluginName,
          type: 'GenAiPlugin',
        })[0],
      }),
      {}
    );
  } catch (e) {
    // do nothing, we were trying to read the old genAiPlanner
  }

  try {
    if (genAiFunctions.length === 0 && Object.keys(genAiPlugins).length === 0) {
      // if we've already found functions and plugins from the genAiPlanner, don't try to read the bundle
      const genAiPlannerBundles = getMetadataFilePaths(cs, 'GenAiPlannerBundle');
      const plannerBundleXml = await fs.promises.readFile(
        genAiPlannerBundles[parsedBotVersion.BotVersion.conversationDefinitionPlanners.genAiPlannerName ?? subjectName],
        'utf-8'
      );
      const parsedPlannerBundle = parser.parse(plannerBundleXml) as {
        GenAiPlannerBundle: {
          genAiPlugins: Array<
            | {
                genAiPluginName: string;
              }
            | { genAiPluginName: string; genAiCustomizedPlugin: { genAiFunctions: Array<{ functionName: string }> } }
          >;
        };
      };
      genAiFunctions = ensureArray(parsedPlannerBundle.GenAiPlannerBundle.genAiPlugins)
        .filter((f) => 'genAiCustomizedPlugin' in f)
        .map(
          ({ genAiCustomizedPlugin }) =>
            genAiCustomizedPlugin.genAiFunctions.find((plugin) => plugin.functionName !== '')!.functionName
        );

      genAiPlugins = ensureArray(parsedPlannerBundle.GenAiPlannerBundle.genAiPlugins).reduce(
        (acc, { genAiPluginName }) => ({
          ...acc,
          [genAiPluginName]: cs.getComponentFilenamesByNameAndType({
            fullName: genAiPluginName,
            type: 'GenAiPlugin',
          })[0],
        }),
        {}
      );
    }
  } catch (e) {
    throw new SfError(
      `Error parsing GenAiPlannerBundle: ${
        parsedBotVersion.BotVersion.conversationDefinitionPlanners.genAiPlannerName ?? subjectName
      }`
    );
  }

  return { genAiPlugins, genAiFunctions };
}

export function ensureYamlExtension(filePath: string): string {
  const parsedPath = parse(filePath);

  if (parsedPath.ext === '.yaml' || parsedPath.ext === '.yml') return filePath;
  const normalized = `${join(parsedPath.dir, parsedPath.name)}.yaml`;
  warn(`Provided file path does not have a .yaml or .yml extension. Normalizing to ${normalized}`);
  return normalized;
}

async function promptUntilUniqueFile(subjectName: string, filePath?: string): Promise<string | undefined> {
  const outputFile =
    filePath ??
    (await input({
      message: 'Enter a filepath for the test spec file',
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
    return promptUntilUniqueFile(subjectName);
  }

  return normalized;
}

/**
 * If the user provides the --force-overwrite flag, then we'll use the default file path (either the one provided by --output-file or the default path).
 * If the user doesn't provide it, we'll prompt the user for a file path until they provide a unique one or cancel.
 */
async function determineFilePath(
  subjectName: string,
  outputFile: string | undefined,
  forceOverwrite: boolean
): Promise<string | undefined> {
  const defaultFile = ensureYamlExtension(outputFile ?? join('specs', `${subjectName}-testSpec.yaml`));
  return forceOverwrite ? defaultFile : promptUntilUniqueFile(subjectName, defaultFile);
}

export default class AgentGenerateTestSpec extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;

  public static readonly flags = {
    'from-definition': Flags.file({
      char: 'd',
      exists: true,
      summary: messages.getMessage('flags.from-definition.summary'),
      parse: async (raw): Promise<string> => {
        if (!raw.endsWith('aiEvaluationDefinition-meta.xml')) {
          throw messages.createError('error.InvalidAiEvaluationDefinition');
        }

        return Promise.resolve(raw);
      },
    }),
    'force-overwrite': Flags.boolean({
      summary: messages.getMessage('flags.force-overwrite.summary'),
    }),
    'output-file': Flags.file({
      char: 'f',
      summary: messages.getMessage('flags.output-file.summary'),
      parse: async (raw): Promise<string> => Promise.resolve(ensureYamlExtension(raw)),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(AgentGenerateTestSpec);

    const directoryPaths = (await SfProject.resolve().then((project) => project.getPackageDirectories())).map(
      (dir) => dir.fullPath
    );

    const cs = await ComponentSetBuilder.build({
      metadata: {
        metadataEntries: ['GenAiPlanner', 'GenAiPlannerBundle', 'GenAiPlugin', 'Bot'],
        directoryPaths,
      },
    });

    if (flags['from-definition']) {
      const agentTest = new AgentTest({ mdPath: flags['from-definition'] });
      const spec = await agentTest.getTestSpec();

      const outputFile = await determineFilePath(spec.subjectName, flags['output-file'], flags['force-overwrite']);
      if (!outputFile) {
        this.log(messages.getMessage('info.cancel'));
        return;
      }

      await agentTest.writeTestSpec(outputFile);
      this.log(`Created ${outputFile}`);
      return;
    }

    const bots = [
      ...cs
        .filter((component) => component.type.name === 'Bot')
        .map((c) => c.fullName)
        .filter((n) => n !== '*'),
    ];
    if (bots.length === 0) {
      throw messages.createError('error.NoAgentsFound', [directoryPaths.join(', ')]);
    }

    const subjectType = (await select<string>({
      message: 'What are you testing',
      choices: ['AGENT'],
      theme,
    })) as 'AGENT';

    const subjectName = await select<string>({
      message: 'Select the agent to test',
      choices: bots,
      theme,
    });

    const outputFile = await determineFilePath(subjectName, flags['output-file'], flags['force-overwrite']);
    if (!outputFile) {
      this.log(messages.getMessage('info.cancel'));
      return;
    }

    const { genAiPlugins, genAiFunctions } = await getPluginsAndFunctions(subjectName, cs);

    const name = await input({
      message: "Enter a name for the test; this name will become the test's label when created in the org",
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
      message: 'Enter a description for the test (optional)',
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
        message: 'Do you want to add another test case',
        default: true,
      })
    );

    this.log();

    const agentTest = new AgentTest({
      specData: {
        name,
        description,
        subjectType,
        subjectName,
        testCases,
      },
    });
    await agentTest.writeTestSpec(outputFile);
    this.log(`Created ${outputFile}`);
  }
}
