/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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

type GenAiPlannerExt = {
  GenAiPlanner: GenAiPlanner & { botTemplate?: string };
};

type BotTemplateExt = {
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
  genAiPlannerPath: string;
  botTemplatePath: string;
};
export default class AgentGenerateTemplate extends SfCommand<AgentGenerateTemplateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'beta';
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
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
      throw new SfError(
        'Invalid Agent file. Must be a Bot metadata file. Example: force-app/main/default/bots/MyBot.bot-meta.xml'
      );
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const builder = new XMLBuilder({ format: true, ignoreAttributes: false, indentBy: '    ' });

    const botName = basename(agentFile).replace('.bot-meta.xml', '');
    // Since we are cloning the GenAiPlanner, we need to use a different name than the Agent (Bot) we started with
    // We will use this name for the BotTemplate also to make it clear they are related
    const finalFilename = `${botName}_v${botVersion}_Template`;

    // Build the base dir from the AgentFile
    const basePath = resolve(dirname(agentFile), '..', '..');
    const botDir = join(basePath, 'bots', botName);
    const genAiPlannerDir = join(basePath, 'genAiPlanners');
    const botTemplateDir = join(basePath, 'botTemplates');

    const botTemplateFilePath = join(botTemplateDir, `${finalFilename}.botTemplate-meta.xml`);
    const clonedGenAiPlannerFilePath = join(genAiPlannerDir, `${finalFilename}.genAiPlanner-meta.xml`);

    // Parse the metadata files as JSON
    const botJson = xmlToJson<BotExt>(join(botDir, `${botName}.bot-meta.xml`), parser);
    const botVersionJson = xmlToJson<BotVersionExt>(join(botDir, `v${botVersion}.botVersion-meta.xml`), parser);
    const genAiPlannerMetaJson = xmlToJson<GenAiPlannerExt>(
      join(genAiPlannerDir, `${botName}.genAiPlanner-meta.xml`),
      parser
    );

    // Modify the metadata files for final output
    // TODO: Confirm this name (might be conversationDefinitionPlanners)
    genAiPlannerMetaJson.GenAiPlanner.botTemplate = finalFilename;
    const botTemplate = convertBotToBotTemplate(botJson, botVersionJson, finalFilename, botTemplateFilePath);

    // Build and save the metadata files
    jsonToXml<GenAiPlannerExt>(clonedGenAiPlannerFilePath, genAiPlannerMetaJson, builder);
    jsonToXml<BotTemplateExt>(botTemplateFilePath, botTemplate, builder);

    this.log(`\nSaved BotTemplate to:\n - ${botTemplateFilePath}`);
    this.log(`Saved GenAiPlanner to:\n - ${clonedGenAiPlannerFilePath}`);

    return {
      genAiPlannerPath: clonedGenAiPlannerFilePath,
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
  const { conversationSystemDialogs } = botVersionJson.BotVersion;

  // We need to pull the botDialog from the BotVersion file that matches the entryDialog
  // This will be added to the BotTemplate
  const entryDialogJson = botVersionJson.BotVersion.botDialogs.find((dialog) => dialog.developerName === entryDialog);

  if (!entryDialogJson) throw new SfError('No entryDialog found in BotVersion file');
  // TODO: Test this on a newer org. I had to have this renamed.
  entryDialogJson.label = entryDialog;

  if (!bot.Bot.label) throw new SfError(`No label found in Agent (Bot) file: ${botFilePath}`);
  if (!bot.Bot.botMlDomain) throw new SfError(`No botMlDomain found in Agent (Bot) file: ${botFilePath}`);
  const masterLabel = bot.Bot.label;
  const mlDomain = bot.Bot.botMlDomain;

  delete bot.Bot.botMlDomain;
  delete bot.Bot.label;
  delete bot.Bot.botUser;
  delete bot.Bot.logPrivateConversationData;
  delete bot.Bot.sessionTimeout;

  // botDialogGroups is not required
  const botTemplate: BotTemplateExt = {
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
