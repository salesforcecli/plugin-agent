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

import { join, dirname, basename, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type {
  Bot,
  BotVersion,
  BotTemplate,
  GenAiPlannerBundle,
  BotDialogGroup,
  ConversationDefinitionGoal,
  ConversationVariable,
  GenAiFunction,
  GenAiPlugin,
  GenAiPlannerFunctionDef,
} from '@salesforce/types/metadata';

export type GenAiPlannerBundleExt = {
  GenAiPlannerBundle: GenAiPlannerBundle & {
    botTemplate?: string;
    localActionLinks?: GenAiPlannerFunctionDef[];
    localTopicLinks: GenAiPlannerFunctionDef[];
    localTopics?: GenAiPlugin[];
    plannerActions?: GenAiFunction[];
  };
};

export type BotTemplateExt = {
  '?xml': { '@_version': '1.0'; '@_encoding': 'UTF-8' };
  BotTemplate: Omit<BotTemplate, 'botDialogGroups' | 'conversationGoals' | 'conversationVariables'> & {
    agentType?: string;
    botDialogGroups?: BotDialogGroup[];
    conversationGoals?: ConversationDefinitionGoal[];
    conversationVariables?: ConversationVariable[];
  };
};

type BotExt = {
  Bot: Bot & {
    agentDSLEnabled?: boolean;
    botSource?: string;
    agentTemplate?: string;
  };
};

type BotVersionExt = {
  BotVersion: BotVersion;
};

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.template');

export type AgentGenerateTemplateResult = {
  genAiPlannerBundlePath: string;
  botTemplatePath: string;
};
export default class AgentGenerateTemplate extends SfCommand<AgentGenerateTemplateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    'api-version': Flags.orgApiVersion(),
    'agent-version': Flags.integer({
      summary: messages.getMessage('flags.agent-version.summary'),
      required: true,
    }),
    'agent-file': Flags.file({
      summary: messages.getMessage('flags.agent-file.summary'),
      char: 'f',
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<AgentGenerateTemplateResult> {
    const { flags } = await this.parse(AgentGenerateTemplate);
    const { 'agent-file': agentFile, 'agent-version': botVersion } = flags;

    if (!agentFile.endsWith('.bot-meta.xml')) {
      throw new SfError(messages.getMessage('error.invalid-agent-file'));
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const builder = new XMLBuilder({ format: true, ignoreAttributes: false, indentBy: '    ' });

    const botName = basename(agentFile, '.bot-meta.xml');
    // Since we are cloning the GenAiPlannerBundle, we need to use a different name than the Agent (Bot) we started with
    // We will use this name for the BotTemplate also to make it clear they are related
    const finalFilename = `${botName}_v${botVersion}_Template`;

    // Build the base dir from the AgentFile
    const basePath = resolve(dirname(agentFile), '..', '..');
    const botDir = join(basePath, 'bots', botName);
    const genAiPlannerBundleDir = join(basePath, 'genAiPlannerBundles');
    const botTemplateDir = join(basePath, 'botTemplates');

    const botTemplateFilePath = join(botTemplateDir, `${finalFilename}.botTemplate-meta.xml`);
    const clonedGenAiPlannerBundleFilePath = join(
      genAiPlannerBundleDir,
      finalFilename,
      `${finalFilename}.genAiPlannerBundle`
    );

    // Parse the metadata files as JSON
    const botJson = xmlToJson<BotExt>(join(botDir, `${botName}.bot-meta.xml`), parser);
    if (botJson.Bot.agentDSLEnabled) {
      throw new SfError(messages.getMessage('error.nga-agent-not-supported'));
    }
    const botVersionJson = xmlToJson<BotVersionExt>(join(botDir, `v${botVersion}.botVersion-meta.xml`), parser);
    const genAiPlannerBundleMetaJson = xmlToJson<GenAiPlannerBundleExt>(
      join(genAiPlannerBundleDir, botName, `${botName}.genAiPlannerBundle`),
      parser
    );

    // Modify the metadata files for final output
    // TODO: Confirm this name (might be conversationDefinitionPlanners)
    genAiPlannerBundleMetaJson.GenAiPlannerBundle.botTemplate = finalFilename;
    const { localTopics, localActions } = getLocalAssets(genAiPlannerBundleMetaJson);
    replaceReferencesToGlobalAssets(genAiPlannerBundleMetaJson, localTopics, localActions);
    const botTemplate = convertBotToBotTemplate(botJson, botVersionJson, finalFilename, botTemplateFilePath);

    // Build and save the metadata files
    jsonToXml<GenAiPlannerBundleExt>(clonedGenAiPlannerBundleFilePath, genAiPlannerBundleMetaJson, builder);
    jsonToXml<BotTemplateExt>(botTemplateFilePath, botTemplate, builder);

    this.log(`\nSaved BotTemplate to:\n - ${botTemplateFilePath}`);
    this.log(`Saved GenAiPlannerBundle to:\n - ${clonedGenAiPlannerBundleFilePath}`);

    return {
      genAiPlannerBundlePath: clonedGenAiPlannerBundleFilePath,
      botTemplatePath: botTemplateFilePath,
    };
  }
}

const convertBotToBotTemplate = (
  bot: BotExt,
  botVersionJson: BotVersionExt,
  newMlDomainName: string,
  botFilePath: string
): BotTemplateExt => {
  const entryDialog = botVersionJson.BotVersion.entryDialog;
  const { conversationSystemDialogs, conversationVariables } = botVersionJson.BotVersion;

  // We need to pull the botDialog from the BotVersion file that matches the entryDialog
  // This will be added to the BotTemplate
  const entryDialogJson = botVersionJson.BotVersion.botDialogs.find((dialog) => dialog.developerName === entryDialog);

  if (!entryDialogJson) throw new SfError(messages.getMessage('error.no-entry-dialog'));
  // TODO: Test this on a newer org. I had to have this renamed.
  entryDialogJson.label = entryDialog;

  // Validate the Bot file to ensure successful Agent creation from a BotTemplate
  if (bot.Bot.type === 'Bot') throw new SfError(messages.getMessage('error.invalid-bot-type', [botFilePath]));
  if (!bot.Bot.label) throw new SfError(messages.getMessage('error.no-label', [botFilePath]));
  if (!bot.Bot.botMlDomain) throw new SfError(messages.getMessage('error.no-ml-domain', [botFilePath]));

  const masterLabel = bot.Bot.label;
  const mlDomain = bot.Bot.botMlDomain;

  delete bot.Bot.botMlDomain;
  delete bot.Bot.label;
  delete bot.Bot.botUser;
  delete bot.Bot.logPrivateConversationData;
  delete bot.Bot.sessionTimeout;
  delete bot.Bot.agentDSLEnabled;
  delete bot.Bot.botSource;
  delete bot.Bot.agentTemplate;

  const botTemplate: BotTemplateExt = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    BotTemplate: {
      masterLabel,
      conversationLanguages: 'en_US',
      botDialogs: [entryDialogJson],
      conversationSystemDialogs,
      conversationVariables,
      entryDialog,
      mlDomain,
      ...bot.Bot,
    },
  };

  // TODO: Test this on a newer org. I had to have this renamed to avoid a conflict.
  botTemplate.BotTemplate.mlDomain!.name = newMlDomainName;

  return botTemplate;
};

const xmlToJson = <T>(path: string, parser: XMLParser): T => {
  const file = readFileSync(path, 'utf8');

  if (!file) throw new SfError(`No metadata file found at ${path}`);

  return parser.parse(file) as T;
};

const jsonToXml = <T>(filename: string, json: T, builder: XMLBuilder): void => {
  // Ensure output dir exists (dir of filename)
  mkdirSync(dirname(filename), { recursive: true });

  try {
    const xml = builder.build(json);
    writeFileSync(filename, xml);
  } catch (error) {
    throw new SfError(`Failed save to file: ${filename}`);
  }
};

/**
 * Extracts local topics and actions from the GenAiPlannerBundle and validates that each has a `source` reference to its global counterpart.
 * Throws if any local topic or action is missing `source`.
 *
 * @param genAiPlannerBundleMetaJson - The GenAiPlannerBundle metadata to read from
 * @returns { localTopics, localActions } - The local topics and the flattened local actions from all plugins
 */
export const getLocalAssets = (
  genAiPlannerBundleMetaJson: GenAiPlannerBundleExt
): { localTopics: GenAiPlugin[]; localActions: GenAiFunction[] } => {
  const rawLocalTopics = genAiPlannerBundleMetaJson.GenAiPlannerBundle.localTopics;
  const localTopics = Array.isArray(rawLocalTopics) ? rawLocalTopics : rawLocalTopics ? [rawLocalTopics] : [];
  const localTopicsWithoutSource = localTopics.filter((topic) => !topic.source);
  if (localTopicsWithoutSource.length > 0) {
    throw new SfError(
      messages.getMessage('error.local-topics-without-source', [
        localTopicsWithoutSource.map((topic) => topic.developerName).join(', '),
      ])
    );
  }
  const actionsFromPlugins = localTopics.flatMap((plugin) =>
    Array.isArray(plugin.localActions) ? plugin.localActions : plugin.localActions ? [plugin.localActions] : []
  );
  const plannerBundle = genAiPlannerBundleMetaJson.GenAiPlannerBundle;
  const plannerActions = Array.isArray(plannerBundle.plannerActions)
    ? plannerBundle.plannerActions
    : plannerBundle.plannerActions
    ? [plannerBundle.plannerActions]
    : [];

  // localActions are the actions from the plugins and the plannerActions
  const localActions = [...actionsFromPlugins, ...plannerActions];
  if (localActions.length > 0) {
    const localActionsWithoutSource = localActions.filter((action) => !action.source);
    if (localActionsWithoutSource.length > 0) {
      throw new SfError(
        messages.getMessage('error.local-actions-without-source', [
          localActionsWithoutSource.map((action) => action.developerName ?? action.fullName).join(', '),
        ])
      );
    }
  }
  return { localTopics, localActions };
};

/**
 * Uses localTopics' <source> elements to identify global assets, then updates topic links (genAiPlugins), action links (genAiFunctions), attributeMappings, ruleExpressionAssignments and ruleExpressions.
 * Replaces localTopicLinks with genAiPlugins and localActionLinks with genAiFunctions in the output.
 */
const replaceReferencesToGlobalAssets = (
  genAiPlannerBundleMetaJson: GenAiPlannerBundleExt,
  localTopics: GenAiPlugin[],
  localActions: GenAiFunction[]
): void => {
  const plannerBundle: GenAiPlannerBundleExt['GenAiPlannerBundle'] = genAiPlannerBundleMetaJson.GenAiPlannerBundle;

  // replace localTopicLinks with global genAiPlugins
  plannerBundle.genAiPlugins = localTopics.map((topic) => ({
    genAiPluginName: topic.source!,
  }));
  plannerBundle.localTopicLinks = [];

  // replace localActionLinks with global genAiFunctions (dedupe by genAiFunctionName)
  const seenFunctions = new Set<string>();
  plannerBundle.genAiFunctions = localActions
    .map((action) => ({ genAiFunctionName: action.source! }))
    .filter((f) => {
      if (seenFunctions.has(f.genAiFunctionName)) return false;
      seenFunctions.add(f.genAiFunctionName);
      return true;
    });
  plannerBundle.localActionLinks = [];

  // replace references in attributeMappings and ruleExpressionAssignments
  const localToGlobalAssets = buildLocalToGlobalAssetMap(localTopics, plannerBundle);
  for (const mapping of plannerBundle.attributeMappings ?? []) {
    mapping.attributeName = replaceLocalRefsWithGlobal(mapping.attributeName, localToGlobalAssets);
  }
  for (const assignment of plannerBundle.ruleExpressionAssignments ?? []) {
    assignment.targetName = replaceLocalRefsWithGlobal(assignment.targetName, localToGlobalAssets);
  }

  // delete local assets from the GenAiPlannerBundle
  plannerBundle.localTopics = [];
  plannerBundle.plannerActions = [];
};

/**
 * Builds a map from local asset names to their global (source) asset names.
 *
 * @param localTopics - The local topics of the GenAiPlannerBundle
 * @param plannerBundle - The GenAiPlannerBundle (for plannerActions)
 * @returns A map of local asset name → global asset name
 */
const buildLocalToGlobalAssetMap = (
  localTopics: GenAiPlugin[],
  plannerBundle: GenAiPlannerBundleExt['GenAiPlannerBundle']
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const topic of localTopics) {
    map.set(topic.fullName!, topic.source!);
    const actions = Array.isArray(topic.localActions)
      ? topic.localActions
      : topic.localActions
      ? [topic.localActions]
      : [];
    for (const action of actions) {
      map.set(action.fullName!, action.source!);
    }
  }
  const plannerActions = Array.isArray(plannerBundle.plannerActions)
    ? plannerBundle.plannerActions
    : plannerBundle.plannerActions
    ? [plannerBundle.plannerActions]
    : [];
  for (const action of plannerActions) {
    if (action.fullName && action.source) map.set(action.fullName, action.source);
  }
  return map;
};

/**
 * Replaces dot-separated local refs with global names. Each segment is replaced only when present in localToGlobalMap;
 * segments not in localToGlobalMap (e.g. namespace, attribute path) are kept as-is. Used for attributeName, targetName, expression.
 */
const replaceLocalRefsWithGlobal = (value: string, localToGlobalMap: Map<string, string>): string =>
  value
    .split('.')
    .map((segment) => localToGlobalMap.get(segment) ?? segment)
    .join('.');
