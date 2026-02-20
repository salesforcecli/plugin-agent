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
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Agent } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { throwAgentCompilationError } from '../../../common.js';
import { FlaggablePrompt, promptForAgentFiles } from '../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.validate.authoring-bundle');

export type AgentValidateAuthoringBundleResult = {
  success: boolean;
  errors?: string[];
};

export default class AgentValidateAuthoringBundle extends SfCommand<AgentValidateAuthoringBundleResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.api-name.summary'),
    }),
  };

  private static readonly FLAGGABLE_PROMPTS = {
    'api-name': {
      message: messages.getMessage('flags.api-name.summary'),
      promptMessage: messages.getMessage('flags.api-name.prompt'),
      validate: (d: string): boolean | string => {
        if (d.length > 80) {
          return 'API name cannot be over 80 characters.';
        }
        const regex = /^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]+$/;
        if (d.length === 0 || !regex.test(d)) {
          return 'Invalid API name.';
        }
        return true;
      },
    },
  } satisfies Record<string, FlaggablePrompt>;

  public async run(): Promise<AgentValidateAuthoringBundleResult> {
    const { flags } = await this.parse(AgentValidateAuthoringBundle);
    // If api-name is not provided, prompt user to select an .agent file from the project and extract the API name from it
    const aabName =
      flags['api-name'] ??
      (await promptForAgentFiles(this.project!, AgentValidateAuthoringBundle.FLAGGABLE_PROMPTS['api-name']));
    const mso = new MultiStageOutput<{ status: string; errors: string }>({
      jsonEnabled: this.jsonEnabled(),
      title: `Validating ${aabName} Authoring Bundle`,
      showTitle: true,
      stages: ['Validating Authoring Bundle'],
      stageSpecificBlock: [
        {
          stage: 'Validating Authoring Bundle',
          label: 'Status',
          type: 'dynamic-key-value',
          get: (data): string => data?.status ?? 'IN PROGRESS',
        },
        {
          stage: 'Validating Authoring Bundle',
          label: 'Errors',
          type: 'dynamic-key-value',
          get: (data): string => data?.errors ?? '0',
        },
      ],
    });

    mso.skipTo('Validating Authoring Bundle');
    const targetOrg = flags['target-org'];
    const conn = targetOrg.getConnection(flags['api-version']);
    const agent = await Agent.init({ connection: conn, project: this.project!, aabName });

    const result = await agent.compile();
    if (result.status === 'success') {
      mso.updateData({ status: 'COMPLETED' });
      mso.stop('completed');
      return {
        success: true,
      };
    }
    // Validation failed with compilation errors -> exit 1 (404/500 set by @salesforce/agents)
    mso.updateData({ errors: result.errors.length.toString(), status: 'ERROR' });
    mso.error();

    this.log(
      messages.getMessage('error.compilationFailed', [
        result.errors
          .map(
            (line) =>
              `- ${colorize('red', line.errorType)}: ${line.description} [Ln ${line.lineStart}, Col ${line.colStart}]`
          )
          .join('\n'),
      ])
    );
    throwAgentCompilationError(result.errors);
  }
}
