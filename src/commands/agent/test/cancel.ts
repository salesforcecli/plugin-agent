/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester } from '@salesforce/agents';
import { AgentTestCache } from '../../../agentTestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.cancel');

export type AgentTestCancelResult = {
  runId: string;
  success: boolean;
  errorCode?: string;
  message?: string;
};

export default class AgentTestCancel extends SfCommand<AgentTestCancelResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'job-id': Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.job-id.summary'),
      exactlyOne: ['use-most-recent', 'job-id'],
    }),
    'use-most-recent': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.use-most-recent.summary'),
      exactlyOne: ['use-most-recent', 'job-id'],
    }),
  };

  public async run(): Promise<AgentTestCancelResult> {
    const { flags } = await this.parse(AgentTestCancel);

    const agentTestCache = await AgentTestCache.create();
    const { runId } = agentTestCache.useIdOrMostRecent(flags['job-id'], flags['use-most-recent']);

    this.log(`Canceling tests for AiEvaluation Job: ${runId}`);

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const result = await agentTester.cancel(runId);

    if (result.success) {
      await agentTestCache.removeCacheEntry(runId);
    }

    return {
      success: result.success,
      runId,
    };
  }
}
