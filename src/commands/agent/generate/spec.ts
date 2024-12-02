/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject } from '@salesforce/core';
import { Interfaces } from '@oclif/core';
import ansis from 'ansis';
import select from '@inquirer/select';
import inquirerInput from '@inquirer/input';
import figures from '@inquirer/figures';
import { Agent, SfAgent } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.spec');

export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  jobSpec?: string; // the location of the job spec file
  // We probably need more than this in the returned JSON like
  // all the parameters used to generate the spec and the spec contents
};

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

export default class AgentCreateSpec extends SfCommand<AgentCreateSpecResult> {
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
      exists: true,
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'config',
    }),
    'file-name': Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.file-name.summary'),
      default: 'agentSpec.json',
    }),
  };

  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpec);

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
    const type = (await this.getFlagOrPrompt(flags.type, FLAGGABLE_PROMPTS.type)) as
      | 'customer_facing'
      | 'employee_facing';
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
    // @ts-expect-error for now
    const agent = new Agent(connection, this.project as SfProject) as SfAgent;
    const agentSpec = await agent.createSpec({
      name: flags['file-name'].split('.json')[0],
      type,
      role,
      companyName,
      companyDescription,
      companyWebsite,
    });

    // Write a file with the returned job specs
    const filePath = join(flags['output-dir'], flags['file-name']);
    writeFileSync(filePath, JSON.stringify(agentSpec, null, 4));

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
