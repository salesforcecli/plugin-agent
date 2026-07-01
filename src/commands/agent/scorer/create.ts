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
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SfCommand, Flags, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages, EnvironmentVariable } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { XMLBuilder } from 'fast-xml-parser';
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

export type ScorerSpecFile = {
  apiName: string;
  dataType: 'Text' | 'Number' | 'LightningType';
  scorerType?: 'Predefined' | 'OpenEnded';
  lightningType?: string;
  semanticType?: 'Dimension' | 'Measurement';
  inputScope?: 'Session' | 'Intent';
  label: string;
  description?: string;
  engineType: 'Manual' | 'PromptTemplate';
  promptContent?: string;
  promptTemplateName?: string;
  status?: 'Available' | 'Draft';
  agentAssociation: {
    agentApiName: string;
    isActive: boolean;
    samplingRate?: number;
    inputScope?: 'Session' | 'Intent';
  };
  outputEnumValues?: Array<{
    value: string;
    outcomeType: 'Pass' | 'Fail' | 'NotApplicable';
    isFallback?: boolean;
    isSystemFallback?: boolean;
  }>;
  specification?: {
    valueSpecification: {
      min: number;
      max: number;
      step: number;
      threshold?: number;
    };
  };
};

const MAX_ENUM_VALUES = 101;

const SUPPORTED_LIGHTNING_TYPES = [
  'lightning__textType',
  'lightning__multilineTextType',
  'lightning__richTextType',
  'lightning__numberType',
  'lightning__integerType',
  'lightning__booleanType',
  'lightning__dateType',
  'lightning__dateTimeType',
  'lightning__dateTimeStringType',
  'lightning__urlType',
  'lightning__objectType',
  'lightning__listType',
];

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
      if (d.length > 35) return 'API name cannot exceed 35 characters';
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(d)) return 'Must start with letter, only alphanumerics and underscores';
      return true;
    },
    required: true,
  },
  'data-type': {
    message: messages.getMessage('flags.data-type.summary'),
    promptMessage: 'What data type does this scorer produce?',
    options: ['Text', 'Number', 'OpenEnded'],
    validate: (d: string): boolean | string => ['Text', 'Number', 'OpenEnded'].includes(d) || 'Invalid data type',
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
    options: ['Manual', 'PromptTemplate'],
    validate: (d: string): boolean | string =>
      ['Manual', 'PromptTemplate'].includes(d) || 'Invalid engine type',
    required: true,
  },
  status: {
    message: messages.getMessage('flags.status.summary'),
    promptMessage: 'Initial status',
    options: ['Draft', 'Available'],
    validate: (d: string): boolean | string => ['Available', 'Draft'].includes(d) || 'Invalid status',
    default: 'Draft',
  },
} satisfies Record<string, FlaggablePrompt>;

type OutputEnumValue = {
  value: string;
  outcomeType: string;
  isFallback: boolean;
  isSystemFallback: boolean;
};

async function promptForOutputEnumValues(): Promise<OutputEnumValue[]> {
  const values: OutputEnumValue[] = [];
  let addMore = true;

  while (addMore) {
    const value = await promptForFlag({
      message: 'Output value name',
      promptMessage: `Output value #${values.length + 1} (e.g., "Good", "Bad", "N/A")`,
      validate: (d: string): boolean | string => d.length > 0 || 'Value cannot be empty',
    });

    const outcomeType = await promptForFlag({
      message: 'Outcome type',
      promptMessage: 'Outcome type for this value',
      options: ['Pass', 'Fail', 'NotApplicable'],
      validate: (d: string): boolean | string =>
        ['Pass', 'Fail', 'NotApplicable'].includes(d) || 'Invalid',
    });

    const isFallback = await confirm({
      message: 'Is this the fallback value?',
      default: values.length === 0,
      theme,
    });

    values.push({
      value,
      outcomeType,
      isFallback,
      isSystemFallback: false,
    });

    addMore = await confirm({
      message: 'Add another output value?',
      default: values.length < 2,
      theme,
    });
  }

  return values;
}

type NumberSpecification = {
  min: number;
  max: number;
  step: number;
  threshold?: number;
};

async function promptForNumberSpecification(): Promise<NumberSpecification> {
  const minStr = await inquirerInput({
    message: 'Minimum value',
    default: '0',
    validate: (d: string): boolean | string => !isNaN(parseFloat(d)) || 'Must be a number',
    theme,
  });

  const maxStr = await inquirerInput({
    message: 'Maximum value',
    default: '5',
    validate: (d: string): boolean | string => !isNaN(parseFloat(d)) || 'Must be a number',
    theme,
  });

  const min = parseFloat(minStr);
  const max = parseFloat(maxStr);

  if (min >= max) {
    throw new Error(`Minimum value (${min}) must be less than maximum value (${max})`);
  }

  const stepStr = await inquirerInput({
    message: 'Step size',
    default: '1',
    validate: (d: string): boolean | string => {
      const n = parseFloat(d);
      if (isNaN(n) || n <= 0) return 'Step must be a positive number';
      const numValues = Math.floor((max - min) / n) + 1;
      if (numValues > MAX_ENUM_VALUES) return `Step too small: would generate ${numValues} values (max ${MAX_ENUM_VALUES})`;
      return true;
    },
    theme,
  });

  const step = parseFloat(stepStr);
  const numValues = Math.floor((max - min) / step) + 1;

  const addThreshold = await confirm({
    message: `Add a threshold value? (${numValues} output values will be generated from ${min} to ${max})`,
    default: false,
    theme,
  });

  let threshold: number | undefined;
  if (addThreshold) {
    const thresholdStr = await inquirerInput({
      message: `Threshold (must be between ${min} and ${max})`,
      validate: (d: string): boolean | string => {
        const n = parseFloat(d);
        if (isNaN(n)) return 'Must be a number';
        if (n < min || n > max) return `Must be between ${min} and ${max}`;
        return true;
      },
      theme,
    });
    threshold = parseFloat(thresholdStr);
  }

  return { min, max, step, threshold };
}

function generateNumberEnumValues(spec: NumberSpecification): OutputEnumValue[] {
  const values: OutputEnumValue[] = [];
  const epsilon = 1e-9;
  let current = spec.min;

  while (current <= spec.max + epsilon) {
    const rounded = Math.round(current * 1e9) / 1e9;
    values.push({
      value: String(rounded),
      outcomeType: 'NotApplicable',
      isFallback: false,
      isSystemFallback: false,
    });
    current += spec.step;
  }

  return values;
}

type AgentAssociation = {
  agentApiName: string;
  isActive: boolean;
  samplingRate?: number;
  inputScope?: 'Session' | 'Intent';
};

function buildScorerXml(spec: ScorerSpecFile): string {
  const engine: Record<string, unknown> = {};
  if (spec.engineType === 'PromptTemplate') {
    engine.engineRef = spec.promptTemplateName ?? spec.apiName;
  }
  engine.engineType = spec.engineType;

  const agentAssociationXml: Record<string, unknown> = {
    agentApiName: spec.agentAssociation.agentApiName,
    ...(spec.agentAssociation.inputScope ? { inputScope: spec.agentAssociation.inputScope } : {}),
    isActive: spec.agentAssociation.isActive,
    samplingRate: spec.agentAssociation.samplingRate ?? 1.0,
  };

  const scorerVersion: Record<string, unknown> = {
    agentAssociation: agentAssociationXml,
    ...(spec.description ? { description: spec.description } : {}),
    engine,
    label: spec.label,
  };

  // For Number type with specification, generate enum values from spec
  if (spec.dataType === 'Number' && spec.specification) {
    const numSpec = spec.specification.valueSpecification;
    const enumValues = generateNumberEnumValues(numSpec);
    scorerVersion.outputEnumValue = enumValues.map((v) => ({
      isFallback: false,
      isSystemFallback: false,
      outcomeType: v.outcomeType,
      value: v.value,
    }));
    scorerVersion.specification = {
      valueSpecification: {
        min: numSpec.min,
        max: numSpec.max,
        step: numSpec.step,
        ...(numSpec.threshold != null ? { threshold: numSpec.threshold } : {}),
      },
    };
  } else if (spec.outputEnumValues) {
    scorerVersion.outputEnumValue = spec.outputEnumValues.map((v) => ({
      isFallback: v.isFallback ?? false,
      isSystemFallback: v.isSystemFallback ?? false,
      outcomeType: v.outcomeType,
      value: v.value,
    }));
  }

  scorerVersion.status = spec.status ?? 'Draft';
  scorerVersion.versionNumber = 1;

  const definition: Record<string, unknown> = {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    dataType: spec.dataType,
    inputScope: spec.inputScope ?? 'Session',
  };

  if (spec.lightningType) {
    definition.lightningType = spec.lightningType;
  }
  if (spec.scorerType) {
    definition.scorerType = spec.scorerType;
  }
  if (spec.semanticType) {
    definition.semanticType = spec.semanticType;
  }

  definition.scorerVersion = scorerVersion;

  const xmlObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    AiAgentScorerDefinition: definition,
  };

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    indentBy: '    ',
    suppressBooleanAttributes: false,
  });

  return builder.build(xmlObj) as string;
}

function getPromptTemplateType(spec: ScorerSpecFile): string {
  if (spec.scorerType === 'OpenEnded') {
    return 'agentforce_session_tracing__scorerOpenEnded';
  }
  if (spec.semanticType === 'Measurement') {
    return 'agentforce_session_tracing__scorerMeasurement';
  }
  return 'agentforce_session_tracing__scorerMultilabel';
}

function buildPromptTemplateXml(apiName: string, promptContent: string, spec: ScorerSpecFile): string {
  const templateType = getPromptTemplateType(spec);

  const isOpenEnded = spec.scorerType === 'OpenEnded';

  const inputs = [
    {
      apiName: 'Session',
      definition: 'lightningtype://propertyType/agentforce_session_tracing__stdmDetailViewType',
      referenceName: 'Input:Session',
      required: true,
    },
    {
      apiName: 'AllowedLabels',
      definition: 'primitive://String',
      referenceName: 'Input:AllowedLabels',
      required: !isOpenEnded,
    },
    {
      apiName: 'FallbackLabel',
      definition: 'primitive://String',
      referenceName: 'Input:FallbackLabel',
      required: !isOpenEnded,
    },
  ];

  const xmlObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    GenAiPromptTemplate: {
      '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      developerName: apiName,
      masterLabel: apiName,
      overridable: false,
      templateVersions: {
        content: promptContent,
        inputs,
        primaryModel: 'sfdc_ai__DefaultOpenAIGPT4OmniMini',
        status: 'Published',
      },
      type: templateType,
      visibility: 'Global',
    },
  };

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    indentBy: '    ',
    suppressBooleanAttributes: false,
  });

  return builder.build(xmlObj) as string;
}

function labelToApiName(label: string): string {
  return label.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
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
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      default: join('force-app', 'main', 'default'),
    }),
    preview: Flags.boolean({
      summary: messages.getMessage('flags.preview.summary'),
    }),
  };

  public async run(): Promise<AgentScorerCreateResult> {
    const { flags } = await this.parse(AgentScorerCreate);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let spec: ScorerSpecFile;

    if (flags.spec) {
      spec = YAML.parse(readFileSync(resolve(flags.spec), 'utf8')) as ScorerSpecFile;
      this.log(`Reading scorer spec from ${flags.spec}`);
    } else {
      if (this.jsonEnabled()) {
        const missing = Object.entries(FLAGGABLE_PROMPTS)
          .filter(([key, p]) => 'required' in p && p.required && !flags[key as keyof typeof flags])
          .map(([key]) => key);
        if (!flags['agent-api-name']) missing.push('agent-api-name');
        if (missing.length) {
          throw messages.createError('error.missingRequiredFlags', [missing.join(', ')]);
        }
      }

      this.log();
      this.styledHeader('Scorer Definition');

      // 1. Label
      const label = flags.label ?? (await promptForFlag(FLAGGABLE_PROMPTS.label));

      // 2. API name (default derived from label)
      const defaultApiName = labelToApiName(label);
      let apiName: string;
      if (flags['api-name']) {
        apiName = flags['api-name'];
      } else {
        apiName = await inquirerInput({
          message: 'Scorer API name',
          default: defaultApiName,
          validate: FLAGGABLE_PROMPTS['api-name'].validate,
          theme,
        });
      }

      // 3. Description
      const description = flags.description ?? (await promptForFlag(FLAGGABLE_PROMPTS.description));

      // 4. Status (default Draft)
      const status = flags.status ?? (await promptForFlag(FLAGGABLE_PROMPTS.status));

      // 5. Data type (output scope)
      const dataType = flags['data-type'] ?? (await promptForFlag(FLAGGABLE_PROMPTS['data-type']));

      // 7. Type-specific collection
      let outputEnumValues: OutputEnumValue[] | undefined;
      let specification: ScorerSpecFile['specification'] | undefined;
      let lightningType: string | undefined;
      let scorerType: ScorerSpecFile['scorerType'] | undefined;

      if (dataType === 'Number') {
        this.log();
        this.styledHeader('Number Scale');
        const numSpec = await promptForNumberSpecification();
        specification = { valueSpecification: numSpec };
      } else if (dataType === 'OpenEnded') {
        this.log();
        this.styledHeader('Open Scorer Configuration');
        scorerType = 'OpenEnded';

        lightningType = await select<string>({
          message: 'Select the lightning type for open-ended values',
          choices: SUPPORTED_LIGHTNING_TYPES.map((t) => ({ name: t, value: t })),
          theme,
        });

        const addEnumValues = await confirm({
          message: 'Add output enum values?',
          default: false,
          theme,
        });
        if (addEnumValues) {
          outputEnumValues = await promptForOutputEnumValues();
        }
      } else {
        // Text
        this.log();
        this.styledHeader('Output Values');
        outputEnumValues = await promptForOutputEnumValues();
      }

      // 7b. Semantic type (optional, for any data type)
      const semanticType = await select<string>({
        message: 'Semantic type (how this scorer is used in analytics)',
        choices: [
          { name: 'None', value: '' },
          { name: 'Dimension (categorical grouping)', value: 'Dimension' },
          { name: 'Measurement (numeric aggregation)', value: 'Measurement' },
        ],
        theme,
      });

      // 7. Engine type
      const engineType = flags['engine-type'] ?? (await promptForFlag(FLAGGABLE_PROMPTS['engine-type']));

      // Prompt template source (only for PromptTemplate engines, before agent selection)
      let promptContent: string | undefined;
      let existingPromptTemplateName: string | undefined;
      if (engineType === 'PromptTemplate') {
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
          existingPromptTemplateName = await inquirerInput({
            message: 'Existing prompt template API name',
            validate: (d: string): boolean | string => d.length > 0 || 'Name cannot be empty',
            theme,
          });
        }
      }

      // 8. Select agent
      let agentAssociation: AgentAssociation;
      if (flags['agent-api-name']) {
        agentAssociation = { agentApiName: flags['agent-api-name'], isActive: false };
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

      // 9. Input scope for the agent association
      const associationInputScope = await select<string>({
        message: 'Input scope for this agent association',
        choices: [
          { name: 'Session', value: 'Session' },
          { name: 'Intent', value: 'Intent' },
        ],
        default: 'Session',
        theme,
      });
      agentAssociation.inputScope = associationInputScope as 'Session' | 'Intent';

      // 10. Activation (only for PromptTemplate engines)
      if (engineType === 'PromptTemplate') {
        const isActive = await confirm({
          message: 'Activate scoring for this agent?',
          default: false,
          theme,
        });
        agentAssociation.isActive = isActive;

        // 11. Sampling rate (only if active)
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

      // Map 'OpenEnded' user-facing name to 'LightningType' metadata value
      const resolvedDataType = dataType === 'OpenEnded' ? 'LightningType' : dataType;

      spec = {
        apiName,
        dataType: resolvedDataType as ScorerSpecFile['dataType'],
        scorerType,
        lightningType,
        semanticType: (semanticType || undefined) as ScorerSpecFile['semanticType'],
        inputScope: 'Session',
        label,
        description: description || undefined,
        engineType: engineType as ScorerSpecFile['engineType'],
        promptContent,
        promptTemplateName: existingPromptTemplateName,
        status: status as ScorerSpecFile['status'],
        outputEnumValues: outputEnumValues as ScorerSpecFile['outputEnumValues'],
        specification,
        agentAssociation,
      };
    }

    // ─── Generate scorer XML ──────────────────────────────────────────────
    const scorerXml = buildScorerXml(spec);
    const outputDir = resolve(flags['output-dir']);
    const scorerDir = join(outputDir, 'aiAgentScorerDefinitions');
    const scorerFileName = `${spec.apiName}.aiAgentScorerDefinition-meta.xml`;
    const scorerPath = join(scorerDir, scorerFileName);

    // ─── Generate prompt template XML (if PromptTemplate engine and not using existing) ──
    let promptTemplatePath: string | undefined;
    let promptTemplateXml: string | undefined;
    if (spec.engineType === 'PromptTemplate' && !spec.promptTemplateName) {
      const promptContent = spec.promptContent ?? buildDefaultPromptContent(spec);
      promptTemplateXml = buildPromptTemplateXml(spec.apiName, promptContent, spec);
      const promptDir = join(outputDir, 'genAiPromptTemplates');
      const promptFileName = `${spec.apiName}.genAiPromptTemplate-meta.xml`;
      promptTemplatePath = join(promptDir, promptFileName);
    }

    if (flags.preview) {
      this.log('\n--- Scorer Definition (preview) ---\n');
      this.log(scorerXml);
      if (promptTemplateXml) {
        this.log('\n--- Prompt Template (preview) ---\n');
        this.log(promptTemplateXml);
      }
      return { path: scorerPath, apiName: spec.apiName, contents: scorerXml, promptTemplatePath };
    }

    // ─── Write scorer ─────────────────────────────────────────────────────
    mkdirSync(scorerDir, { recursive: true });
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
    writeFileSync(scorerPath, scorerXml);
    this.log(`\nScorer definition written to: ${scorerPath}`);

    // ─── Write prompt template ────────────────────────────────────────────
    if (promptTemplateXml && promptTemplatePath) {
      const promptDir = join(outputDir, 'genAiPromptTemplates');
      mkdirSync(promptDir, { recursive: true });
      writeFileSync(promptTemplatePath, promptTemplateXml);
      this.log(`Prompt template written to: ${promptTemplatePath}`);
    }

    return { path: scorerPath, apiName: spec.apiName, contents: scorerXml, promptTemplatePath };
  }

}

function buildDefaultPromptContent(spec: Partial<ScorerSpecFile>): string {
  if (spec.scorerType === 'OpenEnded') {
    return [
      `Analyze the following agent-user conversation and provide your evaluation.`,
      ``,
      `Your response must conform to the expected data type.`,
      ``,
      `session audit data:`,
      `{!$Input:Session}`,
    ].join('\n');
  }

  return [
    `Analyze the following agent-user conversation and evaluate it based on your scoring criteria.`,
    ``,
    `Respond with ONLY one of the allowed values: {!$Input:AllowedLabels}`,
    `or fallback to: {!$Input:FallbackLabel}`,
    ``,
    `session audit data:`,
    `{!$Input:Session}`,
  ].join('\n');
}
