/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { colorize } from '@oclif/core/ux';
import { AgentTester } from '@salesforce/agents';
import { AgentTestCache } from '../../../agentTestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.resume');

export type AgentTestResumeResult = {
  jobId: string;
};

const isTimeoutError = (e: unknown): e is { name: 'PollingClientTimeout' } =>
  (e as { name: string })?.name === 'PollingClientTimeout';

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
    // we want to pass `undefined` to the API
    // eslint-disable-next-line sf-plugin/flag-min-max-default
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      min: 1,
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
    }),
  };

  public async run(): Promise<AgentTestResumeResult> {
    const { flags } = await this.parse(AgentTestResume);

    const agentTestCache = await AgentTestCache.create();
    const id = agentTestCache.useIdOrMostRecent(flags['job-id'], flags['use-most-recent']);

    const mso = new MultiStageOutput<{ id: string; status: string }>({
      jsonEnabled: this.jsonEnabled(),
      title: `Agent Test Run: ${id}`,
      stages: ['Starting Tests', 'Polling for Test Results'],
      stageSpecificBlock: [
        {
          stage: 'Polling for Test Results',
          type: 'dynamic-key-value',
          label: 'Status',
          get: (data) => data?.status,
        },
      ],
      postStagesBlock: [
        {
          type: 'dynamic-key-value',
          label: 'Job ID',
          get: (data) => data?.id,
        },
      ],
    });
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    mso.skipTo('Starting Tests', { id });

    if (flags.wait?.minutes) {
      mso.skipTo('Polling for Test Results');
      const lifecycle = Lifecycle.getInstance();
      lifecycle.on('AGENT_TEST_POLLING_EVENT', async (event: { status: string }) =>
        Promise.resolve(mso.updateData({ status: event?.status }))
      );
      try {
        const { formatted } = await agentTester.poll(id, { timeout: flags.wait });
        mso.stop();
        this.log(formatted);
        await agentTestCache.removeCacheEntry(id);
      } catch (e) {
        if (isTimeoutError(e)) {
          mso.stop('async');
          this.log(`Client timed out after ${flags.wait.minutes} minutes.`);
          this.log(`Run ${colorize('dim', `sf agent test resume --job-id ${id}`)} to resuming watching this test.`);
        } else {
          mso.error();
          throw e;
        }
      }
    } else {
      mso.stop();
      this.log(`Run ${colorize('dim', `sf agent test resume --job-id ${id}`)} to resuming watching this test.`);
    }

    mso.stop();
    return {
      jobId: id, // AiEvaluation.Id; needed for getting status and stopping
    };
  }
}
