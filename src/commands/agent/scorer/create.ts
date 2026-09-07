/*
 * Copyright 2026, Salesforce, Inc.
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
import { join, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { SfCommand, Flags, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages, EnvironmentVariable } from '@salesforce/core';
import {
  Agent,
  type ScorerSpec,
  createScorerDefinition,
  labelToApiName,
  scorerSpecJsonSchema,
  type SupportedLightningType,
  SUPPORTED_LIGHTNING_TYPES,
  SCORER_API_NAME_MAX_LENGTH,
  SCORER_API_NAME_PATTERN,
  SCORER_ENGINE_TYPES,
  SCORER_STATUSES,
  SCORER_OUTCOME_TYPES,
  SCORER_INPUT_SCOPES,
} from '@salesforce/agents';
import { confirm, select, input as inquirerInput } from '@inquirer/prompts';
import YAML from 'yaml';
import { FlaggablePrompt, makeFlags, promptForFlag } from '../../../flags.js';
import { theme } from '../../../inquirer-theme.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.scorer.create');

export type AgentScorerCreateResult = {
  path: string;
  apiName: string;
  contents: string;
  promptTemplatePath?: string;
};

/** @deprecated Use ScorerSpec from @salesforce/agents directly. */
export type ScorerSpecFile = ScorerSpec;

const FLAGGABLE_PROMPTS = {
  label: {
    message: messages.getMessage('flags.label.summary'),
    promptMessage: 'Scorer label (display name)',
    validate: (d: string): boolean | string => d.length > 0 || 'Label cannot be empty',
    required: true,
  },
  'api-name': {
    message: messages.getMessage('flags.api-name.summary'),
    promptMessage: 'Scorer API name',
    validate: (d: string): boolean | string => {
      if (!d.length) return 'API name cannot be empty';
      if (d.length > SCORER_API_NAME_MAX_LENGTH) return `API name cannot exceed ${SCORER_API_NAME_MAX_LENGTH} characters`;
      if (!SCORER_API_NAME_PATTERN.test(d)) return 'Must start with letter, only alphanumerics and underscores';
      return true;
    },
    required: true,
  },
  'lightning-type': {
    message: messages.getMessage('flags.lightning-type.summary'),
    promptMessage: 'Select the lightning type this scorer produces',
    options: SUPPORTED_LIGHTNING_TYPES,
    validate: (d: string): boolean | string =>
      (SUPPORTED_LIGHTNING_TYPES as readonly string[]).includes(d) || 'Invalid lightning type',
    required: true,
  },
  description: {
    message: messages.getMessage('flags.description.summary'),
    promptMessage: 'Description (optional, press Enter to skip)',
    validate: (): boolean | string => true,
  },
  'engine-type': {
    message: messages.getMessage('flags.engine-type.summary'),
    promptMessage: 'Scoring engine type',
    options: SCORER_ENGINE_TYPES,
    validate: (d: string): boolean | string =>
      (SCORER_ENGINE_TYPES as readonly string[]).includes(d) || 'Invalid engine type',
    required: true,
  },
  status: {
    message: messages.getMessage('flags.status.summary'),
    promptMessage: 'Initial status',
    options: SCORER_STATUSES,
    validate: (d: string): boolean | string => (SCORER_STATUSES as readonly string[]).includes(d) || 'Invalid status',
    default: 'Draft',
  },
} satisfies Record<string, FlaggablePrompt>;

type OutputEnumValueInput = {
  value: string;
  outcomeType: string;
  isFallback: boolean;
  isSystemFallback: boolean;
};

async function promptForSingleEnumValue(index: number): Promise<OutputEnumValueInput & { addMore: boolean }> {
  const value = await promptForFlag({
    message: 'Output value name',
    promptMessage: `Output value #${index + 1} (e.g., "Good", "Bad", "N/A")`,
    validate: (d: string): boolean | string => d.length > 0 || 'Value cannot be empty',
  });

  const outcomeType = await promptForFlag({
    message: 'Outcome type',
    promptMessage: 'Outcome type for this value',
    options: SCORER_OUTCOME_TYPES,
    validate: (d: string): boolean | string =>
      (SCORER_OUTCOME_TYPES as readonly string[]).includes(d) || 'Invalid',
  });

  const isFallback = await confirm({
    message: 'Is this the fallback value?',
    default: index === 0,
    theme,
  });

  const addMore = await confirm({
    message: 'Add another output value?',
    default: index < 1,
    theme,
  });

  return { value, outcomeType, isFallback, isSystemFallback: false, addMore };
}

async function promptForOutputEnumValues(): Promise<OutputEnumValueInput[]> {
  const values: OutputEnumValueInput[] = [];
  let addMore = true;

  while (addMore) {
    // eslint-disable-next-line no-await-in-loop
    const result = await promptForSingleEnumValue(values.length);
    addMore = result.addMore;
    values.push({ value: result.value, outcomeType: result.outcomeType, isFallback: result.isFallback, isSystemFallback: result.isSystemFallback });
  }

  return values;
}

export default class AgentScorerCreate extends SfCommand<AgentScorerCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
    'agent-api-name': Flags.string({
      summary: messages.getMessage('flags.agent-api-name.summary'),
    }),
    spec: Flags.file({
      summary: messages.getMessage('flags.spec.summary'),
      exists: true,
    }),
    'spec-schema': Flags.boolean({
      summary: messages.getMessage('flags.spec-schema.summary'),
      default: false,
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      default: join('force-app', 'main', 'default'),
    }),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<AgentScorerCreateResult> {
    const { flags } = await this.parse(AgentScorerCreate);

    if (flags['spec-schema']) {
      this.styledJSON(scorerSpecJsonSchema() as unknown as import('@salesforce/ts-types').AnyJson);
      return { path: '', apiName: '', contents: '' };
    }

    const connection = flags['target-org'].getConnection(flags['api-version']);

    const spec: ScorerSpec = flags.spec
      ? (YAML.parse(readFileSync(resolve(flags.spec), 'utf8')) as ScorerSpec)
      : await this.runInteractiveInterview(flags, connection);

    const outputDir = resolve(flags['output-dir']);

    if (flags.preview) {
      const result = await createScorerDefinition(spec, { outputDir, write: false });
      this.log('\n--- Scorer Definition (preview) ---\n');
      this.log(result.contents);
      if (result.promptTemplateContents) {
        this.log('\n--- Prompt Template (preview) ---\n');
        this.log(result.promptTemplateContents);
      }
      return { path: result.path, apiName: result.apiName, contents: result.contents, promptTemplatePath: result.promptTemplatePath };
    }

    const scorerFileName = `${spec.apiName}.aiAgentScorerDefinition-meta.xml`;
    const scorerPath = join(outputDir, 'aiAgentScorerDefinitions', scorerFileName);

    if (existsSync(scorerPath) && !this.jsonEnabled()) {
      const overwrite = await confirm({
        message: `${scorerFileName} already exists. Overwrite?`,
        default: false,
        theme,
      });
      if (!overwrite) {
        this.log('Operation canceled.');
        return { path: '', apiName: spec.apiName, contents: '' };
      }
    }

    const result = await createScorerDefinition(spec, { outputDir });
    this.log(`\nScorer definition written to: ${result.path}`);
    if (result.promptTemplatePath) {
      this.log(`Prompt template written to: ${result.promptTemplatePath}`);
    }

    return { path: result.path, apiName: result.apiName, contents: result.contents, promptTemplatePath: result.promptTemplatePath };
  }

  private async runInteractiveInterview(
    flags: Record<string, unknown>,
    connection: ReturnType<import('@salesforce/core').Org['getConnection']>
  ): Promise<ScorerSpec> {
    if (this.jsonEnabled()) {
      const missing = Object.entries(FLAGGABLE_PROMPTS)
        .filter(([key, p]) => 'required' in p && p.required && !flags[key])
        .map(([key]) => key);
      if (!flags['agent-api-name']) missing.push('agent-api-name');
      if (missing.length) {
        throw messages.createError('error.missingRequiredFlags', [missing.join(', ')]);
      }
    }

    this.log();
    this.styledHeader('Scorer Definition');

    const label = (flags.label as string) ?? (await promptForFlag(FLAGGABLE_PROMPTS.label));

    const defaultApiName = labelToApiName(label);
    const apiName = (flags['api-name'] as string) ?? (await inquirerInput({
      message: 'Scorer API name',
      default: defaultApiName,
      validate: FLAGGABLE_PROMPTS['api-name'].validate,
      theme,
    }));

    const description = (flags.description as string) ?? (await promptForFlag(FLAGGABLE_PROMPTS.description));
    const status = (flags.status as string) ?? (await promptForFlag(FLAGGABLE_PROMPTS.status));
    const lightningType = ((flags['lightning-type'] as SupportedLightningType) ??
      (await promptForFlag(FLAGGABLE_PROMPTS['lightning-type']))) as SupportedLightningType;

    this.log();
    this.styledHeader('Output Labels');
    const addLabels = await confirm({
      message: 'Add predefined output labels? (leave off for fully open-ended output)',
      default: false,
      theme,
    });
    const outputEnumValues = addLabels ? await promptForOutputEnumValues() : undefined;

    const engineType = (flags['engine-type'] as string) ?? (await promptForFlag(FLAGGABLE_PROMPTS['engine-type']));
    const engineConfig = await this.promptForEngineConfig(engineType);
    const agentAssociation = await this.promptForAgentAssociationDetails(
      connection, engineType, flags['agent-api-name'] as string | undefined
    );

    return {
      apiName,
      lightningType,
      inputScope: 'Session',
      label,
      description: description || undefined,
      engineType: engineType as ScorerSpec['engineType'],
      promptContent: engineConfig.promptContent,
      promptTemplateName: engineConfig.promptTemplateName,
      status: status as ScorerSpec['status'],
      outputEnumValues: outputEnumValues as ScorerSpec['outputEnumValues'],
      agentAssociation,
    };
  }

  private async promptForEngineConfig(engineType: string): Promise<{ promptContent?: string; promptTemplateName?: string }> {
    if (engineType !== 'PromptTemplate') return {};

    this.log();
    this.styledHeader('Prompt Template');

    const promptChoice = await select<string>({
      message: 'Prompt template source',
      choices: [
        { name: 'Generate a new default prompt template', value: 'generate' },
        { name: 'Use an existing prompt template', value: 'existing' },
      ],
      theme,
    });

    if (promptChoice === 'existing') {
      const promptTemplateName = await inquirerInput({
        message: 'Existing prompt template API name',
        validate: (d: string): boolean | string => d.length > 0 || 'Name cannot be empty',
        theme,
      });
      return { promptTemplateName };
    }

    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  private async promptForAgentAssociationDetails(
    connection: ReturnType<import('@salesforce/core').Org['getConnection']>,
    engineType: string,
    agentApiNameFlag?: string
  ): Promise<ScorerSpec['agentAssociation']> {
    let agentAssociation: ScorerSpec['agentAssociation'];
    if (agentApiNameFlag) {
      agentAssociation = { agentApiName: agentApiNameFlag, isActive: false };
    } else {
      const agentsInOrg = await Agent.listRemote(connection);
      if (!agentsInOrg.length) {
        throw new Error('No agents found in the org.');
      }
      const agentApiName = await select<string>({
        message: 'Select the agent to associate with this scorer',
        choices: agentsInOrg
          .filter((a) => !a.IsDeleted)
          .sort((a, b) => a.DeveloperName.localeCompare(b.DeveloperName))
          .map((a) => ({ name: a.DeveloperName, value: a.DeveloperName })),
        theme,
      });
      agentAssociation = { agentApiName, isActive: false };
    }

    const associationInputScope = await select<string>({
      message: 'Input scope for this agent association',
      choices: SCORER_INPUT_SCOPES.map((s) => ({ name: s, value: s })),
      default: 'Session',
      theme,
    });
    agentAssociation.inputScope = associationInputScope as 'Session' | 'Intent';

    if (engineType === 'PromptTemplate') {
      const isActive = await confirm({
        message: 'Activate scoring for this agent?',
        default: false,
        theme,
      });
      agentAssociation.isActive = isActive;

      if (isActive) {
        const samplingRateStr = await promptForFlag({
          message: 'Sampling rate (0.0 - 1.0)',
          promptMessage: 'Sampling rate (0.0 to 1.0, where 1.0 = score every session)',
          validate: (d: string): boolean | string => {
            const n = parseFloat(d);
            if (isNaN(n) || n < 0 || n > 1) return 'Must be between 0.0 and 1.0';
            return true;
          },
          default: '1.0',
        });
        agentAssociation.samplingRate = parseFloat(samplingRateStr);
      }
    }

    return agentAssociation;
  }

}
