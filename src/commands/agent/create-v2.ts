/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import YAML from 'yaml';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { colorize } from '@oclif/core/ux';
import { Agent, AgentJobSpecV2, AgentCreateConfigV2, AgentCreateLifecycleStagesV2 } from '@salesforce/agents';
import { makeFlags, promptForFlag, validateAgentType } from '../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create-v2');

export type AgentCreateResult = {
  isSuccess: boolean;
  errorMessage?: string;
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
  'user-id': {
    message: messages.getMessage('flags.user-id.summary'),
    validate: (d: string): boolean | string => {
      // Allow empty string
      if (d.length === 0) return true;

      if (d.length === 15 || d.length === 18) {
        if (d.startsWith('005')) {
          return true;
        }
      }
      return 'Please enter a valid User ID (005 prefix)';
    }
  },
  'enrich-logs': {
    message: messages.getMessage('flags.enrich-logs.summary'),
    validate: (): boolean | string => true,
    options: ['true', 'false'],
    default: 'false',
  },
  tone: {
    message: messages.getMessage('flags.tone.summary'),
    validate: (): boolean | string => true,
    options: ['formal', 'casual', 'neutral'],
    default: 'casual',
  },
};

export default class AgentCreateV2 extends SfCommand<AgentCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
    spec: Flags.file({
      // char: 'f',
      summary: messages.getMessage('flags.spec.summary'),
      exists: true,
      required: true,
    }),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
    // Currently hidden; Do we even want to expose this?
    'agent-api-name': Flags.string({
      summary: messages.getMessage('flags.agent-api-name.summary'),
      hidden: true,
    }),
    // Currently hidden because only 'en_US' is supported
    'primary-language': Flags.string({
      summary: messages.getMessage('flags.primary-language.summary'),
      options: ['en_US'],
      default: 'en_US',
      hidden: true,
    }),
    // Seems a very uncommon usecase, but it's possible to do it in the server side API
    'planner-id': Flags.string({
      summary: messages.getMessage('flags.planner-id.summary'),
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<AgentCreateResult> {
    const { flags } = await this.parse(AgentCreateV2);

    // throw error if --json is used and not all required flags are provided
    if (this.jsonEnabled()) {
      if (!flags.preview && !flags['agent-name']) {
        throw messages.createError('error.missingRequiredFlags', ['agent-name']);
      }
    }

    // Read the agent spec and validate
    const inputSpec = YAML.parse(readFileSync(resolve(flags.spec), 'utf8')) as Partial<AgentJobSpecV2>;
    validateSpec(inputSpec);

    // If we're saving the agent and we don't have flag values, prompt.
    let agentName = flags['agent-name'];
    let userId = flags['user-id'];
    let enrichLogs = flags['enrich-logs'];
    let tone = flags.tone;
    if (!this.jsonEnabled() && !flags.preview) {
      agentName ??= await promptForFlag(FLAGGABLE_PROMPTS['agent-name']);
      userId ??= await promptForFlag(FLAGGABLE_PROMPTS['user-id']);
      enrichLogs ??= await promptForFlag(FLAGGABLE_PROMPTS['enrich-logs']);
      tone ??= await promptForFlag(FLAGGABLE_PROMPTS.tone);
    }

    let title: string;
    const stages = [MSO_STAGES.parse];
     if (flags.preview) {
      title = 'Previewing Agent Creation';
      stages.push(MSO_STAGES.preview);
     } else {
      title = `Creating ${agentName as string} Agent`;
      stages.push(MSO_STAGES.create);
      stages.push(MSO_STAGES.retrieve);
     }

    const mso = new MultiStageOutput({
      jsonEnabled: this.jsonEnabled(),
      title,
      stages,
    });
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
      agentType: inputSpec.agentType!,
      generationInfo: {
        defaultInfo: {
          role: inputSpec.role!,
          companyName: inputSpec.companyName!,
          companyDescription: inputSpec.companyDescription!,
          preDefinedTopics: inputSpec.topics,
        }
      },
      generationSettings: {},
    }
    if (inputSpec?.companyWebsite) {
      agentConfig.generationInfo.defaultInfo.companyWebsite = inputSpec?.companyWebsite;
    }
    if (!flags.preview) {
      agentConfig.saveAgent = true;
      agentConfig.agentSettings = {
        agentName: agentName!,
      }
      if (flags['agent-api-name']) {
        agentConfig.agentSettings.agentApiName = flags['agent-api-name'];
      }
      if (flags['planner-id']) {
        agentConfig.agentSettings.plannerId = flags['planner-id'];
      }
      if (flags['user-id']) {
        agentConfig.agentSettings.userId = userId;
      }
      agentConfig.agentSettings.enrichLogs = Boolean(enrichLogs);
      agentConfig.agentSettings.tone = tone as 'casual' | 'formal' | 'neutral';
    }
    const response = await agent.createV2(agentConfig);

    mso.stop();

    if (response.isSuccess) {
      if (!flags.preview) {
        this.log(colorize(
          'green',
          `Successfully created ${agentName as string} in ${flags['target-org'].getUsername() ?? 'the target org'}.`
        ));
        this.log(`Use ${colorize('dim', `sf org open agent --name ${agentName as string}`)} to view the agent in the browser.`);
      } else {
        const previewFileName = `agentPreview_${new Date().toISOString()}.json`;
        writeFileSync(previewFileName, JSON.stringify(response, null, 2));
        this.log(colorize('green', `Successfully created agent for preview. See ${previewFileName}`));
      }
    } else {
      this.log(colorize('red', `failed to create agent: ${response.errorMessage ?? ''}`));
    }
    
    return response;
  }
}

// The spec must define: agentType, role, companyName, companyDescription, and topics.
// Agent type must be 'customer' or 'internal'.
const validateSpec = (spec: Partial<AgentJobSpecV2>): void => {
  const requiredSpecValues: Array<'agentType' | 'role' | 'companyName' | 'companyDescription' | 'topics'> =
    ['agentType', 'role', 'companyName', 'companyDescription', 'topics'];
  const missingFlags = requiredSpecValues.filter(f => !spec[f]);
  if (missingFlags.length) {
    throw messages.createError('error.missingRequiredFlags', [missingFlags.join(', ')]);
  }

  validateAgentType(spec.agentType, true);
}
