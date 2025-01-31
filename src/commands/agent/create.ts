/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { input as inquirerInput } from '@inquirer/prompts';
import { colorize } from '@oclif/core/ux';
import {
  Agent,
  AgentJobSpecV2,
  AgentCreateConfigV2,
  AgentCreateLifecycleStagesV2,
  AgentCreateResponseV2,
  generateAgentApiName,
} from '@salesforce/agents';
import { FlaggablePrompt, makeFlags, promptForFlag, validateAgentType } from '../../flags.js';
import { theme } from '../../inquirer-theme.js';
import { AgentSpecFileContents } from './generate/agent-spec.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create');

// The JSON response returned by the command.
export type AgentCreateResult = AgentCreateResponseV2 & {
  previewFilePath?: string;
};

const MSO_STAGES = {
  parse: 'Parsing Agent spec',
  preview: 'Creating Agent for preview',
  create: 'Creating Agent in org',
  retrieve: 'Retrieving Agent metadata',
};

const FLAGGABLE_PROMPTS = {
  'agent-name': {
    message: messages.getMessage('flags.agent-name.summary'),
    validate: (d: string): boolean | string => d.length > 0 || 'Agent Name cannot be empty',
    required: true,
  },
  'agent-api-name': {
    message: messages.getMessage('flags.agent-api-name.summary'),
    validate: (d: string): boolean | string => {
      if (d.length === 0) {
        return true;
      }
      if (d.length > 80) {
        return 'API name cannot be over 80 characters.';
      }
      const regex = /^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]+$/;
      if (!regex.test(d)) {
        return 'Invalid API name.';
      }
      return true;
    },
  },
  spec: {
    message: messages.getMessage('flags.spec.summary'),
    validate: (d: string): boolean | string => {
      const specPath = resolve(d);
      if (!existsSync(specPath)) {
        return 'Please enter an existing agent spec (yaml) file';
      }
      return true;
    },
    required: true,
  },
} satisfies Record<string, FlaggablePrompt>;

export default class AgentCreate extends SfCommand<AgentCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
    // This would be used as more of an agent update than create.
    // Could possibly move to an `agent update` command.
    'planner-id': Flags.string({
      summary: messages.getMessage('flags.planner-id.summary'),
      hidden: true,
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<AgentCreateResult> {
    const { flags } = await this.parse(AgentCreate);

    // throw error if --json is used and not all required flags are provided
    if (this.jsonEnabled()) {
      if (!flags['agent-name']) {
        throw messages.createError('error.missingRequiredFlags', ['agent-name']);
      }
      if (!flags.spec) {
        throw messages.createError('error.missingRequiredFlags', ['spec']);
      }
    }

    // If we don't have an agent spec yet, prompt.
    const specPath = flags.spec ?? (await promptForFlag(FLAGGABLE_PROMPTS['spec']));

    // Read the agent spec and validate
    const inputSpec = YAML.parse(readFileSync(resolve(specPath), 'utf8')) as AgentSpecFileContents;
    validateSpec(inputSpec);

    // If we don't have an agent name yet, prompt.
    const agentName = flags['agent-name'] ?? (await promptForFlag(FLAGGABLE_PROMPTS['agent-name']));
    let agentApiName = flags['agent-api-name'];
    if (!agentApiName) {
      agentApiName = generateAgentApiName(agentName);
      const promptedValue = await inquirerInput({
        message: messages.getMessage('flags.agent-api-name.prompt', [agentApiName]),
        validate: FLAGGABLE_PROMPTS['agent-api-name'].validate,
        theme,
      });
      if (promptedValue?.length) {
        agentApiName = promptedValue;
      }
    }

    let title: string;
    const stages = [MSO_STAGES.parse];
    if (flags.preview) {
      title = `Previewing ${agentName} Creation`;
      stages.push(MSO_STAGES.preview);
    } else {
      title = `Creating ${agentName} Agent`;
      stages.push(MSO_STAGES.create);
      stages.push(MSO_STAGES.retrieve);
    }

    const mso = new MultiStageOutput({ jsonEnabled: this.jsonEnabled(), title, stages });
    mso.goto(MSO_STAGES.parse);

    // @ts-expect-error not using async method in callback
    Lifecycle.getInstance().on(AgentCreateLifecycleStagesV2.Previewing, () => mso.goto(MSO_STAGES.preview));
    // @ts-expect-error not using async method in callback
    Lifecycle.getInstance().on(AgentCreateLifecycleStagesV2.Creating, () => mso.goto(MSO_STAGES.create));
    // @ts-expect-error not using async method in callback
    Lifecycle.getInstance().on(AgentCreateLifecycleStagesV2.Retrieving, () => mso.goto(MSO_STAGES.retrieve));

    const connection = flags['target-org'].getConnection(flags['api-version']);
    const agent = new Agent(connection, this.project!);

    const agentConfig: AgentCreateConfigV2 = {
      agentType: inputSpec.agentType,
      generationInfo: {
        defaultInfo: {
          role: inputSpec.role,
          companyName: inputSpec.companyName,
          companyDescription: inputSpec.companyDescription,
          preDefinedTopics: inputSpec.topics,
        },
      },
      generationSettings: {},
    };
    if (inputSpec?.companyWebsite) {
      agentConfig.generationInfo.defaultInfo.companyWebsite = inputSpec?.companyWebsite;
    }
    if (!flags.preview) {
      agentConfig.saveAgent = true;
      agentConfig.agentSettings = { agentName, agentApiName };
      if (flags['planner-id']) {
        agentConfig.agentSettings.plannerId = flags['planner-id'];
      }
      if (inputSpec?.agentUser) {
        // TODO: query for the user ID from the username
        agentConfig.agentSettings.userId = inputSpec.agentUser;
      }
      if (inputSpec?.enrichLogs) {
        agentConfig.agentSettings.enrichLogs = inputSpec.enrichLogs;
      }
      if (inputSpec?.tone) {
        agentConfig.agentSettings.tone = inputSpec.tone;
      }
    }
    const response = await agent.createV2(agentConfig);
    const result: AgentCreateResult = response;

    mso.stop();

    if (response.isSuccess) {
      if (!flags.preview) {
        const orgUsername = flags['target-org'].getUsername() as string;
        this.log(`Successfully created ${agentName} in ${orgUsername}.\n`);
        this.log(
          `Use ${colorize(
            'dim',
            `sf org open agent --name ${agentApiName} -o ${orgUsername}`
          )} to view the agent in the browser.`
        );
      } else {
        const previewFileName = `${agentApiName}_Preview_${new Date().toISOString()}.json`;
        writeFileSync(previewFileName, JSON.stringify(response, null, 2));
        result.previewFilePath = resolve(previewFileName);
        this.log(`Successfully created agent for preview. See ${previewFileName}\n`);
      }
    } else {
      this.log(colorize('red', `Failed to create agent: ${response.errorMessage ?? ''}`));
    }

    return result;
  }
}

// The spec must define: agentType, role, companyName, companyDescription, and topics.
// Agent type must be 'customer' or 'internal'.
const validateSpec = (spec: Partial<AgentJobSpecV2>): void => {
  const requiredSpecValues: Array<'agentType' | 'role' | 'companyName' | 'companyDescription' | 'topics'> = [
    'agentType',
    'role',
    'companyName',
    'companyDescription',
    'topics',
  ];
  const missingFlags = requiredSpecValues.filter((f) => !spec[f]);
  if (missingFlags.length) {
    throw messages.createError('error.missingRequiredSpecProperties', [missingFlags.join(', ')]);
  }

  validateAgentType(spec.agentType, true);
};
