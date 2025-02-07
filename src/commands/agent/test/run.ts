/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { AgentTester } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { CLIError } from '@oclif/core/errors';
import { resultFormatFlag, testOutputDirFlag } from '../../../flags.js';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';
import { handleTestResults } from '../../../handleTestResults.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

// TODO: this should include details and status
export type AgentTestRunResult = {
  runId: string;
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
    }),
    // we want to pass `undefined` to the API
    // eslint-disable-next-line sf-plugin/flag-min-max-default
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      min: 1,
      summary: messages.getMessage('flags.wait.summary'),
    }),
    'result-format': resultFormatFlag(),
    'output-dir': testOutputDirFlag(),
  };

  private mso: TestStages | undefined;

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestRun);

    this.mso = new TestStages({ title: `Agent Test Run: ${flags.name}`, jsonEnabled: this.jsonEnabled() });
    this.mso.start();

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const response = await agentTester.start(flags.name);

    this.mso.update({ id: response.runId });

    const agentTestCache = await AgentTestCache.create();
    await agentTestCache.createCacheEntry(response.runId, flags.name);

    if (flags.wait?.minutes) {
      const { completed, response: detailsResponse } = await this.mso.poll(agentTester, response.runId, flags.wait);
      if (completed) await agentTestCache.removeCacheEntry(response.runId);

      this.mso.stop();

      await handleTestResults({
        id: response.runId,
        format: flags['result-format'],
        results: detailsResponse,
        jsonEnabled: this.jsonEnabled(),
        outputDir: flags['output-dir'],
      });

      return {
        status: 'COMPLETED',
        runId: response.runId,
      };
    } else {
      this.mso.stop();
      this.log(
        `Run ${colorize('dim', `sf agent test resume --job-id ${response.runId}`)} to resuming watching this test.`
      );
    }

    return response;
  }

  protected catch(error: Error | SfError | CLIError): Promise<never> {
    this.mso?.error();
    return super.catch(error);
  }
}
