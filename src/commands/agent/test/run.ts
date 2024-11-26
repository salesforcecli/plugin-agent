/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MultiStageOutput } from '@oclif/multi-stage-output';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages } from '@salesforce/core';
import { AgentTester } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { resultFormatFlag } from '../../../flags.js';
import { AgentTestCache } from '../../../agentTestCache.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

const isTimeoutError = (e: unknown): e is { name: 'PollingClientTimeout' } =>
  (e as { name: string })?.name === 'PollingClientTimeout';

// TODO: this should include details and status
export type AgentTestRunResult = {
  jobId: string; // AiEvaluation.Id
};

export default class AgentTestRun extends SfCommand<AgentTestRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    // This should probably be "test-name"
    // Is it `AiEvaluationDefinition_My_first_test_v1`? or `"My first test v1"`? or `My_first_test_v1`?
    id: Flags.string({
      char: 'i',
      required: true,
      summary: messages.getMessage('flags.id.summary'),
      description: messages.getMessage('flags.id.description'),
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
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    'result-format': resultFormatFlag(),
  };

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestRun);
    const mso = new MultiStageOutput<{ id: string; status: string }>({
      jsonEnabled: this.jsonEnabled(),
      title: `Agent Test Run: ${flags.id}`,
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
    mso.skipTo('Starting Tests');
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const response = await agentTester.start(flags.id);

    mso.updateData({ id: response.id });

    const ttlConfig = await AgentTestCache.create();
    await ttlConfig.createCacheEntry(response.id);

    if (flags.wait?.minutes) {
      mso.skipTo('Polling for Test Results');
      const lifecycle = Lifecycle.getInstance();
      lifecycle.on('AGENT_TEST_POLLING_EVENT', async (event: { status: string }) =>
        Promise.resolve(mso.updateData({ status: event?.status }))
      );
      try {
        const { formatted } = await agentTester.poll(response.id, { timeout: flags.wait });
        mso.stop();
        this.log(formatted);
        await ttlConfig.removeCacheEntry(response.id);
      } catch (e) {
        if (isTimeoutError(e)) {
          mso.stop('async');
          this.log(`Client timed out after ${flags.wait.minutes} minutes.`);
          this.log(
            `Run ${colorize('dim', `sf agent test resume --job-id ${response.id}`)} to resuming watching this test.`
          );
        } else {
          mso.error();
          throw e;
        }
      }
    } else {
      mso.stop();
      this.log(
        `Run ${colorize('dim', `sf agent test resume --job-id ${response.id}`)} to resuming watching this test.`
      );
    }

    mso.stop();
    return {
      jobId: response.id, // AiEvaluation.Id; needed for getting status and stopping
    };
  }
}
