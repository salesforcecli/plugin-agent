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
import { EOL } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Messages, Lifecycle, SfError } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { RequestStatus, type ScopedPostRetrieve } from '@salesforce/source-deploy-retrieve';
import { ensureArray } from '@salesforce/kit';
import { FlaggablePrompt, promptForAgentFiles } from '../../../flags.js';
import { findAuthoringBundleInProject } from '../../../utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.publish.authoring-bundle');

export type AgentPublishAuthoringBundleResult = {
  success: boolean;
  botDeveloperName?: string;
  errors?: string[];
};

export default class AgentPublishAuthoringBundle extends SfCommand<AgentPublishAuthoringBundleResult> {
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

  public async run(): Promise<AgentPublishAuthoringBundleResult> {
    const { flags } = await this.parse(AgentPublishAuthoringBundle);
    // If api-name is not provided, prompt user to select an .agent file from the project and extract the API name from it
    const apiName =
      flags['api-name'] ??
      (await promptForAgentFiles(this.project!, AgentPublishAuthoringBundle.FLAGGABLE_PROMPTS['api-name']));
    const authoringBundleDir = findAuthoringBundleInProject(this.project!, apiName);

    if (!authoringBundleDir) {
      throw new SfError(messages.getMessage('error.agentNotFound', [apiName]), 'AgentNotFoundError', [
        messages.getMessage('error.agentNotFoundAction'),
      ]);
    }
    // Create multi-stage output
    const mso = new MultiStageOutput<{ agentName: string }>({
      stages: ['Validate Bundle', 'Publish Agent', 'Retrieve Metadata'],
      title: 'Publishing Agent',
      data: { agentName: apiName },
      jsonEnabled: this.jsonEnabled(),
      postStagesBlock: [
        {
          label: 'Agent Name',
          type: 'static-key-value',
          get: (data) => data?.agentName,
          bold: true,
          color: 'cyan',
        },
      ],
    });
    try {
      mso.goto('Validate Bundle');
      const targetOrg = flags['target-org'];
      const conn = targetOrg.getConnection(flags['api-version']);

      // First compile the .agent file to get the Agent JSON
      const agentJson = await Agent.compileAfScript(
        conn,
        readFileSync(join(authoringBundleDir, `${apiName}.agent`), 'utf8')
      );
      mso.skipTo('Publish Agent');

      // Then publish the Agent JSON to create the agent
      // Set up lifecycle listeners for retrieve events
      Lifecycle.getInstance().on('scopedPreRetrieve', () => {
        mso.skipTo('Retrieve Metadata');
        return Promise.resolve();
      });

      Lifecycle.getInstance().on('scopedPostRetrieve', (result: ScopedPostRetrieve) => {
        if (result.retrieveResult.response.status === RequestStatus.Succeeded) {
          mso.stop();
        } else {
          const errorMessage = `Metadata retrieval failed: ${ensureArray(
            // @ts-expect-error I saw errorMessages populated with useful information during testing
            result?.retrieveResult.response?.messages ?? result?.retrieveResult?.response?.errorMessage
          ).join(EOL)}`;
          mso.error();
          throw new SfError(errorMessage);
        }
        return Promise.resolve();
      });
      const result = await Agent.publishAgentJson(conn, this.project!, agentJson);
      mso.stop();

      return {
        success: true,
        botDeveloperName: result.developerName,
      };
    } catch (error) {
      // Handle validation errors
      const err = SfError.wrap(error);
      const errorMessage = messages.getMessage('error.publishFailed', [err.message]);

      // Stop the multi-stage output on error
      mso.error();

      this.error(errorMessage);

      return {
        success: false,
        errors: err.message.split('\n'),
      };
    }
  }
}
