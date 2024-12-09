/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester, AgentTestDetailsResponse } from '@salesforce/agents';
import { resultFormatFlag, testOutputDirFlag } from '../../../flags.js';
import { handleTestResults } from '../../../handleTestResults.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.results');

export type AgentTestResultsResult = AgentTestDetailsResponse;

export default class AgentTestResults extends SfCommand<AgentTestResultsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'job-id': Flags.string({
      summary: messages.getMessage('flags.job-id.summary'),
      char: 'i',
      required: true,
    }),
    'result-format': resultFormatFlag(),
    'output-dir': testOutputDirFlag(),
  };

  public async run(): Promise<AgentTestResultsResult> {
    const { flags } = await this.parse(AgentTestResults);

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const response = await agentTester.details(flags['job-id']);
    await handleTestResults({
      id: flags['job-id'],
      format: flags['result-format'],
      results: response,
      jsonEnabled: this.jsonEnabled(),
      outputDir: flags['output-dir'],
    });
    return response;
  }
}
