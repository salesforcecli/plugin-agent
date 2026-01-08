/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { AgentTester, AgentTestResultsResponse } from '@salesforce/agents';
import { resultFormatFlag, testOutputDirFlag, verboseFlag } from '../../../flags.js';
import { handleTestResults } from '../../../handleTestResults.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.results');

export type AgentTestResultsResult = AgentTestResultsResponse;

export default class AgentTestResults extends SfCommand<AgentTestResultsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

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
    verbose: verboseFlag,
  };

  public async run(): Promise<AgentTestResultsResult> {
    const { flags } = await this.parse(AgentTestResults);

    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));
    const response = await agentTester.results(flags['job-id']);
    await handleTestResults({
      id: flags['job-id'],
      format: flags['result-format'],
      results: response,
      jsonEnabled: this.jsonEnabled(),
      outputDir: flags['output-dir'],
      verbose: flags.verbose,
    });
    return response;
  }
}
