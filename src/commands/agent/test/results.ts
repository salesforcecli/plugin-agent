/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester, AgentTestDetailsResponse } from '@salesforce/agents';
import { resultFormatFlag } from '../../../flags.js';

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
      description: messages.getMessage('flags.job-id.description'),
      char: 'i',
      required: true,
    }),
    'result-format': resultFormatFlag(),
  };

  public async run(): Promise<AgentTestResultsResult> {
    const { flags } = await this.parse(AgentTestResults);

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const { response, formatted } = await agentTester.details(flags['job-id'], flags['result-format']);
    this.log(formatted);
    return response;
  }
}
