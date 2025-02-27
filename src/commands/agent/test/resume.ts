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
import { resultFormatFlag, testOutputDirFlag } from '../../../flags.js';
import { handleTestResults } from '../../../handleTestResults.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.resume');

export type AgentTestResumeResult = {
  runId: string;
  status: string;
};

export default class AgentTestResume extends SfCommand<AgentTestResumeResult> {
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
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      min: 1,
      defaultValue: 5,
      summary: messages.getMessage('flags.wait.summary'),
    }),
    'result-format': resultFormatFlag(),
    'output-dir': testOutputDirFlag(),
  };

  public async run(): Promise<AgentTestResumeResult> {
    const { flags } = await this.parse(AgentTestResume);

    const agentTestCache = await AgentTestCache.create();
    const { name, runId, outputDir } = agentTestCache.useIdOrMostRecent(flags['job-id'], flags['use-most-recent']);

    const mso = new TestStages({
      title: `Agent Test Run: ${name ?? runId}`,
      jsonEnabled: this.jsonEnabled(),
    });
    mso.start({ id: runId });
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));

    const { completed, response } = await mso.poll(agentTester, runId, flags.wait);
    if (completed) await agentTestCache.removeCacheEntry(runId);

    mso.stop();

    await handleTestResults({
      id: runId,
      format: flags['result-format'],
      results: response,
      jsonEnabled: this.jsonEnabled(),
      outputDir: outputDir ?? flags['output-dir'],
    });

    return {
      status: 'COMPLETED',
      runId,
    };
  }
}
