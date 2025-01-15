/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import ansis from 'ansis';
import YAML from 'yaml';
import select from '@inquirer/select';
import inquirerInput from '@inquirer/input';
import figures from '@inquirer/figures';
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
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'config',
    }),
    'file-name': Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.file-name.summary'),
      default: 'agentSpec.yaml',
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

  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpecV2);

    // throw error if --json is used and not all required flags are provided
    if (this.jsonEnabled()) {
      const missingFlags = Object.entries(FLAGGABLE_PROMPTS)
        .filter(([key, prompt]) => 'required' in prompt && prompt.required && !(key in flags))
        .map(([key]) => key);

      if (missingFlags.length) {
        throw new Error(`Missing required flags: ${missingFlags.join(', ')}`);
      }
    }

    this.log();
    this.styledHeader('Agent Details');
    const type = (await this.getFlagOrPrompt(flags.type, FLAGGABLE_PROMPTS.type)) as 'customer' | 'internal';
    const role = await this.getFlagOrPrompt(flags.role, FLAGGABLE_PROMPTS.role);
    const companyName = await this.getFlagOrPrompt(flags['company-name'], FLAGGABLE_PROMPTS['company-name']);
    const companyDescription = await this.getFlagOrPrompt(
      flags['company-description'],
      FLAGGABLE_PROMPTS['company-description']
    );
    const companyWebsite = await this.getFlagOrPrompt(flags['company-website'], FLAGGABLE_PROMPTS['company-website']);

    this.log();
    this.spinner.start('Creating agent spec');

    const connection = flags['target-org'].getConnection(flags['api-version']);
    const agent = new Agent(connection, this.project as SfProject);
    const specConfig: AgentJobSpecCreateConfigV2 = {
      agentType: type,
      role,
      companyName,
      companyDescription,
    };
    if (companyWebsite) {
      specConfig.companyWebsite = companyWebsite;
    }
    if (flags['prompt-template']) {
      specConfig.promptTemplateName = flags['prompt-template'];
      if (flags['grounding-context']) {
        specConfig.groundingContext = flags['grounding-context'];
      }
    }
    if (flags['max-topics']) {
      specConfig.maxNumOfTopics = flags['max-topics'];
    }
    const agentSpec = await agent.createSpecV2(specConfig);

    // create the directory if not already created
    mkdirSync(join(flags['output-dir']), { recursive: true });

    // Write a yaml file with the returned job specs
    const filePath = join(flags['output-dir'], flags['file-name']);
    writeFileSync(filePath, YAML.stringify(agentSpec));

    this.spinner.stop();

    this.log(`\nSaved agent spec: ${filePath}`);

    return { ...{ isSuccess: true, specPath: filePath }, ...agentSpec };
  }

  /**
   * Get a flag value or prompt the user for a value.
   *
   * Resolution order:
   * - Flag value provided by the user
   * - Prompt the user for a value
   */
  public async getFlagOrPrompt(valueFromFlag: string | undefined, flagDef: FlaggablePrompt): Promise<string> {
    const message = flagDef.message.replace(/\.$/, '');

    if (valueFromFlag) {
      this.log(`${ansis.green(figures.tick)} ${ansis.bold(message)} ${ansis.cyan(valueFromFlag)}`);

      return valueFromFlag;
    }

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
  }
}
