/*
 * Copyright 2025, Salesforce, Inc.
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Agent, findAuthoringBundle } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
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
    const apiName =
      flags['api-name'] ??
      (await promptForAgentFiles(this.project!, AgentValidateAuthoringBundle.FLAGGABLE_PROMPTS['api-name']));
    const authoringBundleDir = findAuthoringBundle(
      this.project!.getPackageDirectories().map((dir) => dir.fullPath),
      apiName
    );
    if (!authoringBundleDir) {
      throw new SfError(messages.getMessage('error.agentNotFound', [apiName]), 'AgentNotFoundError', [
        messages.getMessage('error.agentNotFoundAction'),
      ]);
    }
    const mso = new MultiStageOutput<{ status: string; errors: string }>({
      jsonEnabled: this.jsonEnabled(),
      title: `Validating ${apiName} Authoring Bundle`,
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
    const result = await Agent.compileAgentScript(
      conn,
      readFileSync(join(authoringBundleDir, `${apiName}.agent`), 'utf8')
    );
    mso.updateData({ status: 'COMPLETED' });
    mso.stop('completed');
    if (result.status === 'failure') {
      // Handle validation errors
      let count = 0;
      const formattedError = result.errors
        .map((e) => {
          count += 1;
          return `- ${colorize('red', e.errorType)} ${e.description}: ${e.lineStart}:${e.colStart} / ${e.lineEnd}:${
            e.colEnd
          }`;
        })
        .join('\n');

      mso.updateData({ errors: count.toString(), status: 'ERROR' });
      mso.error();

      this.log(messages.getMessage('error.compilationFailed', [formattedError]));
      return {
        success: false,
        errors: [formattedError],
      };
    } else {
      return {
        success: true,
      };
    }
  }
}
