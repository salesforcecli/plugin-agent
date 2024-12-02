/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester } from '@salesforce/agents';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.resume');

export type AgentTestResumeResult = {
  aiEvaluationId: string;
};

export default class AgentTestResume extends SfCommand<AgentTestResumeResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

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
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      min: 1,
      defaultValue: 5,
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
    }),
  };

  public async run(): Promise<AgentTestResumeResult> {
    const { flags } = await this.parse(AgentTestResume);

    const agentTestCache = await AgentTestCache.create();
    const { name, aiEvaluationId } = agentTestCache.useIdOrMostRecent(flags['job-id'], flags['use-most-recent']);

    const mso = new TestStages({
      title: `Agent Test Run: ${name ?? aiEvaluationId}`,
      jsonEnabled: this.jsonEnabled(),
    });
    mso.start({ id: aiEvaluationId });
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));

    const completed = await mso.poll(agentTester, aiEvaluationId, flags.wait);
    if (completed) await agentTestCache.removeCacheEntry(aiEvaluationId);

    mso.stop();
    return {
      aiEvaluationId,
    };
  }
}
