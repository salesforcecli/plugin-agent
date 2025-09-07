/*
 * Copyright 2025, Salesforce, Inc.
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
  GenAiPlanner,
  BotDialogGroup,
  ConversationDefinitionGoal,
  ConversationVariable,
} from '@salesforce/types/metadata';

export type GenAiPlannerBundleExt = {
  GenAiPlannerBundle: GenAiPlanner & { botTemplate?: string };
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
  Bot: Bot;
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
    const botVersionJson = xmlToJson<BotVersionExt>(join(botDir, `v${botVersion}.botVersion-meta.xml`), parser);
    const genAiPlannerBundleMetaJson = xmlToJson<GenAiPlannerBundleExt>(
      join(genAiPlannerBundleDir, botName, `${botName}.genAiPlannerBundle`),
      parser
    );

    // Modify the metadata files for final output
    // TODO: Confirm this name (might be conversationDefinitionPlanners)
    genAiPlannerBundleMetaJson.GenAiPlannerBundle.botTemplate = finalFilename;
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

  const botTemplate: BotTemplateExt = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    BotTemplate: {
      masterLabel,
      conversationLanguages: 'en_US',
      mainMenuDialog: 'Main_Menu',
      botDialogs: [
        {
          developerName: 'Main_Menu',
          isPlaceholderDialog: false,
          label: 'Main_Menu',
          showInFooterMenu: false,
          botSteps: [],
        },
        entryDialogJson,
      ],
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
    const xml = builder.build(json) as string;
    writeFileSync(filename, xml);
  } catch (error) {
    throw new SfError(`Failed save to file: ${filename}`);
  }
};
