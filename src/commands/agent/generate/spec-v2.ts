/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, resolve, dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import YAML from 'yaml';
import select from '@inquirer/select';
import inquirerInput from '@inquirer/input';
import { Agent, AgentJobSpecCreateConfigV2, AgentJobSpecV2 } from '@salesforce/agents';
import { theme } from '../../../inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.spec-v2');

export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  specPath?: string; // the location of the job spec file
} & AgentJobSpecV2;

type FlaggablePrompt = {
  message: string;
  options?: readonly string[] | string[];
  validate: (d: string) => boolean | string;
  char?: Interfaces.AlphabetLowercase | Interfaces.AlphabetUppercase;
  required?: boolean;
};

type FlagsOfPrompts<T extends Record<string, FlaggablePrompt>> = Record<
  keyof T,
  Interfaces.OptionFlag<string | undefined, Interfaces.CustomOptions>
>;

const FLAGGABLE_PROMPTS = {
  type: {
    message: messages.getMessage('flags.type.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Type cannot be empty',
    char: 't',
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
        new URL(d);
        return true;
      } catch (e) {
        return 'Please enter a valid URL';
      }
    },
  },
} satisfies Record<string, FlaggablePrompt>;

function validateInput(input: string, validate: (input: string) => boolean | string): never | string {
  const result = validate(input);
  if (typeof result === 'string') throw new Error(result);
  return input;
}

function makeFlags<T extends Record<string, FlaggablePrompt>>(flaggablePrompts: T): FlagsOfPrompts<T> {
  return Object.fromEntries(
    Object.entries(flaggablePrompts).map(([key, value]) => [
      key,
      Flags.string({
        summary: value.message,
        options: value.options,
        char: value.char,
        // eslint-disable-next-line @typescript-eslint/require-await
        async parse(input) {
          return validateInput(input, value.validate);
        },
        // NOTE: we purposely omit the required property here because we want to allow the flag to be missing in interactive mode
      }),
    ])
  ) as FlagsOfPrompts<T>;
}

export default class AgentCreateSpecV2 extends SfCommand<AgentCreateSpecResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'beta';
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
    spec: Flags.file({
      summary: messages.getMessage('flags.spec.summary'),
      exists: true,
    }),
    'output-file': Flags.file({
      summary: messages.getMessage('flags.output-file.summary'),
      default: join('config', 'agentSpec.yaml'),
    }),
    'max-topics': Flags.integer({
      summary: messages.getMessage('flags.max-topics.summary'),
      min: 1,
    }),
    'prompt-template': Flags.string({
      summary: messages.getMessage('flags.prompt-template.summary'),
    }),
    'grounding-context': Flags.string({
      summary: messages.getMessage('flags.grounding-context.summary'),
      dependsOn: ['prompt-template'],
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpecV2);

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
    let inputSpec: Partial<AgentJobSpecV2> = {};
    if (flags.spec) {
      inputSpec = YAML.parse(readFileSync(resolve(flags.spec), 'utf8')) as Partial<AgentJobSpecV2>;
    }

    // Flags override inputSpec values.  Prompt if neither is set.
    const type = flags.type ?? validateAgentType(inputSpec?.agentType) ?? (await promptForFlag(FLAGGABLE_PROMPTS.type));
    const role = flags.role ?? inputSpec?.role ?? (await promptForFlag(FLAGGABLE_PROMPTS.role));
    const companyName =
      flags['company-name'] ?? inputSpec?.companyName ?? (await promptForFlag(FLAGGABLE_PROMPTS['company-name']));
    const companyDescription =
      flags['company-description'] ??
      inputSpec?.companyDescription ??
      (await promptForFlag(FLAGGABLE_PROMPTS['company-description']));
    const companyWebsite =
      flags['company-website'] ??
      inputSpec?.companyWebsite ??
      (await promptForFlag(FLAGGABLE_PROMPTS['company-website']));

    this.log();
    this.spinner.start('Creating agent spec');

    const connection = flags['target-org'].getConnection(flags['api-version']);
    const agent = new Agent(connection, this.project as SfProject);
    const specConfig: AgentJobSpecCreateConfigV2 = {
      agentType: type as 'customer' | 'internal',
      role,
      companyName,
      companyDescription,
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
    const maxNumOfTopics = flags['max-topics'] ?? validateMaxTopics(inputSpec?.maxNumOfTopics);
    if (maxNumOfTopics) {
      specConfig.maxNumOfTopics = maxNumOfTopics;
    }
    // Should we log the specConfig being used?  It's returned in the JSON and the generated spec.
    // this.log(`${ansis.green(figures.tick)} ${ansis.bold(message)} ${ansis.cyan(valueFromFlag)}`);
    const agentSpec = await agent.createSpecV2(specConfig);

    const outputFilePath = writeSpecFile(flags['output-file'], agentSpec);

    this.spinner.stop();

    this.log(`\nSaved agent spec: ${outputFilePath}`);

    return { ...{ isSuccess: true, specPath: outputFilePath }, ...agentSpec };
  }
}

const promptForFlag = async (flagDef: FlaggablePrompt): Promise<string> => {
  const message = flagDef.message.replace(/\.$/, '');
  if (flagDef.options) {
    return select({
      choices: flagDef.options.map((o) => ({ name: o, value: o })),
      message,
      theme,
    });
  }

  return inquirerInput({
    message,
    validate: flagDef.validate,
    theme,
  });
};

const validateAgentType = (agentType?: string): string | undefined => {
  if (agentType) {
    if (!['customer', 'internal'].includes(agentType.trim())) {
      throw messages.createError('error.invalidAgentType', [agentType]);
    }
    return agentType.trim();
  }
};

const validateMaxTopics = (maxTopics?: number): number | undefined => {
  if (maxTopics) {
    if (!isNaN(maxTopics) && isFinite(maxTopics)) {
      if (maxTopics > 0) {
        return maxTopics;
      }
    }
    throw messages.createError('error.invalidMaxTopics', [maxTopics]);
  }
};

const writeSpecFile = (outputFile: string, agentSpec: AgentJobSpecV2): string => {
  // create the directory if not already created
  const outputFilePath = resolve(outputFile);
  mkdirSync(dirname(outputFilePath), { recursive: true });

  // Write a yaml file with the returned job specs
  writeFileSync(outputFilePath, YAML.stringify(agentSpec));

  return outputFilePath;
};
