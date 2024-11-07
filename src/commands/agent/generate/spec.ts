/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Duration, sleep } from '@salesforce/kit';
import { Interfaces } from '@oclif/core';
import ansis from 'ansis';
import select from '@inquirer/select';
import inquirerInput from '@inquirer/input';
import figures from '@inquirer/figures';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create.spec');

export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  jobSpec?: string; // the location of the job spec file
  // We probably need more than this in the returned JSON like
  // all the parameters used to generate the spec and the spec contents
};

// This is a GET of '/services/data/v62.0/connect/agent-job-spec?agentType...

// Mocked job spec, which is a list of AI generated jobs to be done
const jobSpecContent = [
  {
    jobTitle: 'My first job title',
    jobDescription: 'This is what the first job does',
  },
  {
    jobTitle: 'My second job title',
    jobDescription: 'This is what the second job does',
  },
  {
    jobTitle: 'My third job title',
    jobDescription: 'This is what the third job does',
  },
];

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
  name: {
    message: messages.getMessage('flags.name.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Name cannot be empty',
    char: 'n',
    required: true,
  },
  type: {
    message: messages.getMessage('flags.type.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Type cannot be empty',
    char: 't',
    options: ['customer_facing', 'employee_facing'],
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
      if (!d.length) return 'Company website cannot be empty';

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

export default class AgentCreateSpec extends SfCommand<AgentCreateSpecResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
    'output-dir': Flags.directory({
      char: 'd',
      exists: true,
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'config',
    }),
  };

  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpec);

    // We'll need to generate a GenAiPlanner using the name flag and deploy it
    // as part of this, at least for now. We won't have to do this with the
    // new API being created for us.

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
    await this.getFlagOrPrompt(flags.name, FLAGGABLE_PROMPTS.name);
    await this.getFlagOrPrompt(flags.type, FLAGGABLE_PROMPTS.type);
    await this.getFlagOrPrompt(flags.role, FLAGGABLE_PROMPTS.role);
    await this.getFlagOrPrompt(flags['company-name'], FLAGGABLE_PROMPTS['company-name']);
    await this.getFlagOrPrompt(flags['company-description'], FLAGGABLE_PROMPTS['company-description']);
    await this.getFlagOrPrompt(flags['company-website'], FLAGGABLE_PROMPTS['company-website']);

    this.log();
    this.spinner.start('Creating agent spec');

    // To simulate time spent on the server generating the spec.
    await sleep(Duration.seconds(2));

    // GET to /services/data/{api-version}/connect/agent-job-spec

    // Write a file with the returned job specs
    const filePath = join(flags['output-dir'], 'agentSpec.json');
    writeFileSync(filePath, JSON.stringify(jobSpecContent, null, 4));

    this.spinner.stop();

    this.log(`\nSaved agent spec: ${filePath}`);

    return {
      isSuccess: true,
      jobSpec: filePath,
    };
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
        theme: {
          prefix: { idle: ansis.blueBright('?') },
        },
      });
    }

    return inquirerInput({
      message,
      validate: flagDef.validate,
      theme: {
        prefix: { idle: ansis.blueBright('?') },
      },
    });
  }
}
