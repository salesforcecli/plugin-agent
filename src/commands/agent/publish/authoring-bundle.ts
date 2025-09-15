/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Lifecycle, SfError } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { RetrieveResult, RequestStatus } from '@salesforce/source-deploy-retrieve';
import { ensureArray } from '@salesforce/kit';
import { findAndReadAfScript } from '../../../utils/afscriptFinder.js';

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
      required: true,
    }),
  };

  public async run(): Promise<AgentPublishAuthoringBundleResult> {
    const { flags } = await this.parse(AgentPublishAuthoringBundle);
    const afScript = findAndReadAfScript(this.project!.getPath(), flags['api-name']);

    if (!afScript) {
      throw new SfError(messages.getMessage('error.afscriptNotFound', [flags['api-name']]), 'AfScriptNotFoundError', [
        messages.getMessage('error.afscriptNotFoundAction'),
      ]);
    }

    try {
      const targetOrg = flags['target-org'];
      const conn = targetOrg.getConnection(flags['api-version']);

      // Set up lifecycle listeners for retrieve events
      Lifecycle.getInstance().on('scopedPreRetrieve', () =>
        Promise.resolve(this.log('Starting metadata retrieval...'))
      );

      Lifecycle.getInstance().on('scopedPostRetrieve', (result: RetrieveResult) => {
        const message =
          result.response.status === RequestStatus.Succeeded
            ? 'Successfully retrieved metadata'
            : `Metadata retrieval failed: ${ensureArray(result?.response?.messages).join(EOL)}`;
        return Promise.resolve(this.log(message));
      });

      // First compile the AF script to get the Agent JSON
      this.log('Compiling authoring bundle...');
      const agentJson = await Agent.compileAfScript(conn, afScript);

      // Then publish the Agent JSON to create the agent
      this.log('Publishing agent...');
      const result = await Agent.publishAgentJson(conn, this.project!, agentJson);

      this.log('Successfully published agent');
      return {
        success: true,
        botDeveloperName: result.botDeveloperName,
      };
    } catch (error) {
      // Handle validation errors
      const err = error instanceof Error ? error : new Error(String(error));

      this.error(messages.getMessage('error.publishFailed', [err.message]));

      return {
        success: false,
        errors: err.message.split('\n'),
      };
    }
  }
}
