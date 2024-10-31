/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.cancel');

export type AgentTestCancelResult = {
  jobId: string; // AiEvaluation.Id
  success: boolean;
  errorCode?: string;
  message?: string;
};

export default class AgentTestCancel extends SfCommand<AgentTestCancelResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'job-id': Flags.string({
      char: 'i',
      required: true,
      summary: messages.getMessage('flags.id.summary'),
    }),
    'use-most-recent': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.use-most-recent.summary'),
      exactlyOne: ['use-most-recent', 'job-id'],
    }),
    //
    // Future flags:
    //   ??? api-version ???
  };

  public async run(): Promise<AgentTestCancelResult> {
    const { flags } = await this.parse(AgentTestCancel);

    this.log(`Canceling tests for AiEvaluation Job: ${flags['job-id']}`);

    // Call SF Eval Connect API passing AiEvaluation.Id
    // POST to /einstein/ai-evaluations/{aiEvaluationId}/stop

    // Returns: AiEvaluation.Id

    return {
      success: true,
      jobId: '4KBSM000000003F4AQ', // AiEvaluation.Id
    };
  }
}
