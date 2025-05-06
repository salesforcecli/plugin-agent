/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, resolve, dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SfCommand, Flags, prompts } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import YAML from 'yaml';
import { Agent, AgentJobSpecCreateConfig, AgentJobSpec, AgentTone, AgentType } from '@salesforce/agents';
import {
  FlaggablePrompt,
  makeFlags,
  promptForFlag,
  validateAgentType,
  validateMaxTopics,
  validateTone,
  validateAgentUser,
} from '../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.agent-spec');

// The JSON response returned by the command.
export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  specPath?: string; // the location of the job spec file
} & AgentJobSpec;

// Agent spec file schema
export type AgentSpecFileContents = AgentJobSpec & {
  agentUser?: string;
  enrichLogs?: boolean;
  tone?: AgentTone;
  primaryLanguage?: 'en_US';
};

export const FLAGGABLE_PROMPTS = {
  type: {
    message: messages.getMessage('flags.type.summary'),
    promptMessage: messages.getMessage('flags.type.prompt'),
    validate: (d: string): boolean | string => d.length > 0 || 'Type cannot be empty',
    options: ['customer', 'internal'],
    required: true,
  },
  role: {
    message: messages.getMessage('flags.role.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Role cannot be empty',
    required: true,
  },
  'company-name': {
    message: messages.getMessage('flags.company-name.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Company name cannot be empty',
    required: true,
  },
  'company-description': {
    message: messages.getMessage('flags.company-description.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Company description cannot be empty',
    required: true,
  },
  'company-website': {
    message: messages.getMessage('flags.company-website.summary'),
    validate: (d: string): boolean | string => {
      // Allow empty string
      if (d.length === 0) return true;

      try {
        const regExp = new RegExp('^(http|https)://', 'i');
        const companySite = regExp.test(d) ? d : `https://${d}`;
        new URL(companySite);
        return true;
      } catch (e) {
        return 'Please enter a valid URL';
      }
    },
  },
  'max-topics': {
    message: messages.getMessage('flags.max-topics.summary'),
    promptMessage: messages.getMessage('flags.max-topics.prompt'),
    validate: (d: string): boolean | string => {
      if (d.length === 0) return true;

      // convert to a number
      const maxTopics = Number(d.trim());
      if (typeof maxTopics === 'number' && maxTopics > 0 && maxTopics < 31) {
        return true;
      }
      return 'Please enter a number between 1-30';
    },
    default: '5',
  },
  'agent-user': {
    message: messages.getMessage('flags.agent-user.summary'),
    promptMessage: messages.getMessage('flags.agent-user.prompt'),
    validate: (): boolean | string => true,
  },
  'enrich-logs': {
    message: messages.getMessage('flags.enrich-logs.summary'),
    promptMessage: messages.getMessage('flags.enrich-logs.prompt'),
    validate: (): boolean | string => true,
    options: ['true', 'false'],
    default: 'false',
  },
  tone: {
    message: messages.getMessage('flags.tone.summary'),
    promptMessage: messages.getMessage('flags.tone.prompt'),
    validate: (): boolean | string => true,
    options: ['formal', 'casual', 'neutral'],
    default: 'casual',
  },
  // 'primary-language': {
  //   message: messages.getMessage('flags.primary-language.summary'),
  //   validate: (): boolean | string => true,
  //   options: ['en_US'],
  //   default: 'en_US',
  // },
} satisfies Record<string, FlaggablePrompt>;

export default class AgentCreateSpec extends SfCommand<AgentCreateSpecResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
    // a spec file can be used as input. Allows iterative spec development.
    spec: Flags.file({
      summary: messages.getMessage('flags.spec.summary'),
      exists: true,
    }),
    'output-file': Flags.file({
      summary: messages.getMessage('flags.output-file.summary'),
      default: join('specs', 'agentSpec.yaml'),
    }),
    'full-interview': Flags.boolean({
      summary: messages.getMessage('flags.full-interview.summary'),
    }),
    'prompt-template': Flags.string({
      summary: messages.getMessage('flags.prompt-template.summary'),
    }),
    'grounding-context': Flags.string({
      summary: messages.getMessage('flags.grounding-context.summary'),
      dependsOn: ['prompt-template'],
    }),
    'force-overwrite': Flags.boolean({
      summary: messages.getMessage('flags.force-overwrite.summary'),
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpec);

    const outputFile = await resolveOutputFile(flags['output-file'], flags['force-overwrite']);

    // throw error if --json is used and not all required flags are provided
    if (this.jsonEnabled()) {
      const missingFlags = Object.entries(FLAGGABLE_PROMPTS)
        .filter(([key, prompt]) => 'required' in prompt && prompt.required && !(key in flags))
        .map(([key]) => key);

      if (missingFlags.length) {
        throw messages.createError('error.missingRequiredFlags', [missingFlags.join(', ')]);
      }
    }

    this.log();
    this.styledHeader('Agent Details');

    // If spec is provided, read it first
    let inputSpec: Partial<AgentSpecFileContents> = {};
    if (flags.spec) {
      inputSpec = YAML.parse(readFileSync(resolve(flags.spec), 'utf8')) as AgentSpecFileContents;
    }

    // Flags override inputSpec values.  Prompt if neither is set.
    const type = flags.type ?? validateAgentType(inputSpec?.agentType) ?? (await promptForFlag(FLAGGABLE_PROMPTS.type));
    const companyName =
      flags['company-name'] ?? inputSpec?.companyName ?? (await promptForFlag(FLAGGABLE_PROMPTS['company-name']));
    const companyDescription =
      flags['company-description'] ??
      inputSpec?.companyDescription ??
      (await promptForFlag(FLAGGABLE_PROMPTS['company-description']));
    const role = flags.role ?? inputSpec?.role ?? (await promptForFlag(FLAGGABLE_PROMPTS.role));

    const connection = flags['target-org'].getConnection(flags['api-version']);

    // full interview prompts
    const companyWebsite =
      flags['company-website'] ??
      inputSpec?.companyWebsite ??
      (flags['full-interview'] ? await promptForFlag(FLAGGABLE_PROMPTS['company-website']) : undefined);
    const maxNumOfTopics =
      flags['max-topics'] ??
      validateMaxTopics(inputSpec?.maxNumOfTopics) ??
      (flags['full-interview'] ? await promptForFlag(FLAGGABLE_PROMPTS['max-topics']) : 5) ??
      5;
    const agentUser =
      flags['agent-user'] ??
      inputSpec?.agentUser ??
      (flags['full-interview'] ? await promptForFlag(FLAGGABLE_PROMPTS['agent-user']) : undefined);
    await validateAgentUser(connection, agentUser);
    let enrichLogs =
      flags['enrich-logs'] ??
      inputSpec?.enrichLogs ??
      (flags['full-interview'] ? await promptForFlag(FLAGGABLE_PROMPTS['enrich-logs']) : undefined);
    enrichLogs = Boolean(enrichLogs === 'true' || enrichLogs === true);
    let tone: AgentTone =
      (flags.tone as AgentTone) ??
      inputSpec?.tone ??
      (flags['full-interview'] ? await promptForFlag(FLAGGABLE_PROMPTS.tone) : 'casual');
    tone = validateTone(tone as AgentTone);
    // const primaryLanguage =
    //   flags['primary-language'] ??
    //   inputSpec?.primaryLanguage ??
    //   (flags['full-interview'] ? await promptForFlag(FLAGGABLE_PROMPTS['primary-language']) : undefined);

    this.log();
    this.spinner.start('Creating agent spec');

    const specConfig: AgentJobSpecCreateConfig = {
      agentType: type as AgentType,
      companyName,
      companyDescription,
      role,
    };
    if (companyWebsite) {
      specConfig.companyWebsite = companyWebsite;
    }
    const promptTemplateName = flags['prompt-template'] ?? inputSpec?.promptTemplateName;
    if (promptTemplateName) {
      specConfig.promptTemplateName = promptTemplateName;
      const groundingContext = flags['grounding-context'] ?? inputSpec?.groundingContext;
      if (groundingContext) {
        specConfig.groundingContext = groundingContext;
      }
    }
    if (maxNumOfTopics) {
      specConfig.maxNumOfTopics = Number(maxNumOfTopics);
    }

    const specResponse = await Agent.createSpec(connection, specConfig);
    const specFileContents = buildSpecFile(specResponse, { agentUser, enrichLogs, tone });

    const outputFilePath = writeSpecFile(outputFile, specFileContents);

    this.spinner.stop();

    this.log(`\nSaved agent spec: ${outputFilePath}`);

    return { ...{ isSuccess: true, specPath: outputFilePath }, ...specResponse, ...specFileContents };
  }
}

// Builds spec file contents from the spec response and any additional flags
// in a specific order.
const buildSpecFile = (
  specResponse: AgentJobSpec,
  extraProps: Partial<AgentSpecFileContents>
): AgentSpecFileContents => {
  const propertyOrder = [
    'agentType',
    'companyName',
    'companyDescription',
    'companyWebsite',
    'role',
    'maxNumOfTopics',
    'agentUser',
    'enrichLogs',
    'tone',
    // 'primaryLanguage',
    'promptTemplateName',
    'groundingContext',
    'topics',
  ];
  const specFileContents = {};
  propertyOrder.map((prop) => {
    // @ts-expect-error need better typing of the array.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let val = specResponse[prop] ?? extraProps[prop];
    if (val != null || (typeof val === 'string' && val.length > 0)) {
      if (prop === 'topics') {
        // Ensure topics are [{name, description}]
        val = (val as string[]).map((t) =>
          Object.keys(t)
            .sort()
            .reverse()
            .reduce(
              (acc, key) => ({
                ...acc,
                // @ts-expect-error need better typing of the array.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                [key]: t[key],
              }),
              {}
            )
        );
      }
      // @ts-expect-error need better typing of the array.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      specFileContents[prop] = val;
    }
  });
  return specFileContents as AgentSpecFileContents;
};

const writeSpecFile = (outputFile: string, agentSpec: AgentJobSpec): string => {
  // create the directory if not already created
  const outputFilePath = resolve(outputFile);
  mkdirSync(dirname(outputFilePath), { recursive: true });

  // Write a yaml file with the returned job specs
  writeFileSync(outputFilePath, YAML.stringify(agentSpec));

  return outputFilePath;
};

const resolveOutputFile = async (outputFile: string, noPrompt = false): Promise<string> => {
  let resolvedOutputFile = resolve(outputFile);
  if (!noPrompt) {
    if (existsSync(resolvedOutputFile)) {
      const message = messages.getMessage('confirmSpecOverwrite', [resolvedOutputFile]);
      if (!(await prompts.confirm({ message }))) {
        return resolveOutputFile(
          await promptForFlag({
            message: messages.getMessage('flags.output-file.summary'),
            validate: (d: string): boolean | string => d.length > 0 || 'Output file cannot be empty',
          })
        );
      }
    }
  }
  if (!resolvedOutputFile.endsWith('.yaml')) {
    resolvedOutputFile = `${resolvedOutputFile}.yaml`;
  }
  return resolvedOutputFile;
};
