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

import { SfCommand, Flags, toHelpSection } from '@salesforce/sf-plugins-core';
import { EnvironmentVariable, Messages, SfError } from '@salesforce/core';
import { AgentTestResultsResponse, AgentTestNGTResultsResponse } from '@salesforce/agents';
import { resultFormatFlag, testOutputDirFlag, testRunnerTypeFlag, verboseFlag } from '../../../flags.js';
import { handleTestResults } from '../../../handleTestResults.js';
import { createTestRunner } from '../../../testRunnerFactory.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.results');

export type AgentTestResultsResult = AgentTestResultsResponse | AgentTestNGTResultsResponse;

export default class AgentTestResults extends SfCommand<AgentTestResultsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Results retrieved successfully. Test results (passed/failed) are in the output.',
    'NotFound (2)': 'Job ID not found or invalid.',
    'Failed (4)': 'Failed to retrieve results due to API or network errors.',
  });

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
    'test-runner': testRunnerTypeFlag,
    verbose: verboseFlag,
  };

  public async run(): Promise<AgentTestResultsResult> {
    const { flags } = await this.parse(AgentTestResults);

    const connection = flags['target-org'].getConnection(flags['api-version']);
    const { runner: agentTester } = await createTestRunner(
      connection,
      flags['test-runner'],
      undefined,
      flags['job-id']
    );

    let response;
    try {
      response = await agentTester.results(flags['job-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);

      // Check for job not found errors
      if (
        wrapped.message.toLowerCase().includes('not found') ||
        wrapped.message.toLowerCase().includes('invalid') ||
        wrapped.code === 'ENOENT'
      ) {
        throw new SfError(`Job ID '${flags['job-id']}' not found or invalid.`, 'JobNotFound', [], 2, wrapped);
      }

      // API/network failures
      throw new SfError(
        `Failed to retrieve results: ${wrapped.message}`,
        'ResultsRetrievalFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

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
