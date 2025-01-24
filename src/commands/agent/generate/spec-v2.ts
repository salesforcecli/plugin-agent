/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, resolve, dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import YAML from 'yaml';
import { Agent, AgentJobSpecCreateConfigV2, AgentJobSpecV2 } from '@salesforce/agents';
import {
  FLAGGABLE_SPEC_PROMPTS,
  makeFlags,
  promptForFlag,
  validateAgentType,
  validateMaxTopics,
} from '../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.spec-v2');

export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  specPath?: string; // the location of the job spec file
} & AgentJobSpecV2;

export default class AgentCreateSpecV2 extends SfCommand<AgentCreateSpecResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'beta';
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_SPEC_PROMPTS),
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
      const missingFlags = Object.entries(FLAGGABLE_SPEC_PROMPTS)
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
    const type =
      flags.type ?? validateAgentType(inputSpec?.agentType) ?? (await promptForFlag(FLAGGABLE_SPEC_PROMPTS.type));
    const role = flags.role ?? inputSpec?.role ?? (await promptForFlag(FLAGGABLE_SPEC_PROMPTS.role));
    const companyName =
      flags['company-name'] ?? inputSpec?.companyName ?? (await promptForFlag(FLAGGABLE_SPEC_PROMPTS['company-name']));
    const companyDescription =
      flags['company-description'] ??
      inputSpec?.companyDescription ??
      (await promptForFlag(FLAGGABLE_SPEC_PROMPTS['company-description']));
    const companyWebsite =
      flags['company-website'] ??
      inputSpec?.companyWebsite ??
      (await promptForFlag(FLAGGABLE_SPEC_PROMPTS['company-website']));

    this.log();
    this.spinner.start('Creating agent spec');

    const connection = flags['target-org'].getConnection(flags['api-version']);
    const agent = new Agent(connection, this.project!);
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

const writeSpecFile = (outputFile: string, agentSpec: AgentJobSpecV2): string => {
  // create the directory if not already created
  const outputFilePath = resolve(outputFile);
  mkdirSync(dirname(outputFilePath), { recursive: true });

  // Write a yaml file with the returned job specs
  writeFileSync(outputFilePath, YAML.stringify(agentSpec));

  return outputFilePath;
};
