/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { resultFormatFlag } from '../../../flags.js';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

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

    const mso = new TestStages({ title: `Agent Test Run: ${flags.id}`, jsonEnabled: this.jsonEnabled() });
    mso.start();

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const response = await agentTester.start(flags.id);

    mso.update({ id: response.id });

    const agentTestCache = await AgentTestCache.create();
    await agentTestCache.createCacheEntry(response.id, flags.id);

    if (flags.wait?.minutes) {
      const completed = await mso.poll(agentTester, response.id, flags.wait);
      if (completed) await agentTestCache.removeCacheEntry(response.id);
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
