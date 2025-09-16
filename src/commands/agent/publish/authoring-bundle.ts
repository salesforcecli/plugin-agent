/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { Messages, Lifecycle, SfError } from '@salesforce/core';
import { Agent, findAuthoringBundle } from '@salesforce/agents';
import { RequestStatus, type ScopedPostRetrieve } from '@salesforce/source-deploy-retrieve';
import { ensureArray } from '@salesforce/kit';

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
    // todo: this eslint warning can be removed once published
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const authoringBundleDir = findAuthoringBundle(this.project!.getPath(), flags['api-name']);

    if (!authoringBundleDir) {
      throw new SfError(messages.getMessage('error.afscriptNotFound', [flags['api-name']]), 'AfScriptNotFoundError', [
        messages.getMessage('error.afscriptNotFoundAction'),
      ]);
    }
    // Create multi-stage output
    const mso = new MultiStageOutput<{ agentName: string }>({
      stages: ['Validate Bundle', 'Publish Agent', 'Retrieve Metadata'],
      title: 'Publishing Agent',
      data: { agentName: flags['api-name'] },
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
            result?.retrieveResult.response?.messages
          ).join(EOL)}`;
          mso.error();
          throw new SfError(errorMessage);
        }
        return Promise.resolve();
      });

      // First compile the AF script to get the Agent JSON
      const agentJson = await Agent.compileAfScript(
        conn,
        readFileSync(join(authoringBundleDir, `${flags['api-name']}.afscript`), 'utf8')
      );
      mso.skipTo('Publish Agent');

      // Then publish the Agent JSON to create the agent
      const result = await Agent.publishAgentJson(conn, this.project!, agentJson);
      mso.stop();

      return {
        success: true,
        botDeveloperName: result.botDeveloperName,
      };
    } catch (error) {
      // Handle validation errors
      const err = error instanceof Error ? error : new Error(String(error));
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
