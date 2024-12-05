/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester, humanFormat } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { resultFormatFlag } from '../../../flags.js';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

// TODO: this should include details and status
export type AgentTestRunResult = {
  aiEvaluationId: string;
  status: string;
};

export default class AgentTestRun extends SfCommand<AgentTestRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    name: Flags.string({
      char: 'n',
      required: true,
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
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
    'result-format': resultFormatFlag(),
  };

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestRun);

    const mso = new TestStages({ title: `Agent Test Run: ${flags.name}`, jsonEnabled: this.jsonEnabled() });
    mso.start();

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const response = await agentTester.start(flags.name);

    mso.update({ id: response.aiEvaluationId });

    const agentTestCache = await AgentTestCache.create();
    await agentTestCache.createCacheEntry(response.aiEvaluationId, flags.name);

    if (flags.wait?.minutes) {
      const { completed, response: detailsResponse } = await mso.poll(agentTester, response.aiEvaluationId, flags.wait);
      if (completed) await agentTestCache.removeCacheEntry(response.aiEvaluationId);

      mso.stop();

      if (detailsResponse && flags['result-format'] === 'human') {
        this.log(await humanFormat(flags.name, detailsResponse));
      }
      return {
        status: 'COMPLETED',
        aiEvaluationId: response.aiEvaluationId,
      };
    } else {
      mso.stop();
      this.log(
        `Run ${colorize(
          'dim',
          `sf agent test resume --job-id ${response.aiEvaluationId}`
        )} to resuming watching this test.`
      );
    }

    return response;
  }
}
