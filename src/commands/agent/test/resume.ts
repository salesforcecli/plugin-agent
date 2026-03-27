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
import { AgentTester } from '@salesforce/agents';
import { CLIError } from '@oclif/core/errors';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';
import { AgentTestRunResult, resultFormatFlag, testOutputDirFlag, verboseFlag } from '../../../flags.js';
import { handleTestResults } from '../../../handleTestResults.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.resume');

export default class AgentTestResume extends SfCommand<AgentTestRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Test completed successfully (with test results in the output).',
    'Failed (1)': 'Tests encountered execution errors (test cases with ERROR status).',
    'NotFound (2)': 'Job ID not found or invalid.',
    'OperationFailed (4)': 'Failed to poll test due to API or network errors.',
  });

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
    verbose: verboseFlag,
  };

  private mso: TestStages | undefined;

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestResume);

    const agentTestCache = await AgentTestCache.create();
    let name;
    let runId;
    let outputDir;
    let resultFormat;

    try {
      const cacheEntry = agentTestCache.useIdOrMostRecent(flags['job-id'], flags['use-most-recent']);
      name = cacheEntry.name;
      runId = cacheEntry.runId;
      outputDir = cacheEntry.outputDir;
      resultFormat = cacheEntry.resultFormat;
    } catch (e) {
      const wrapped = SfError.wrap(e);

      // Check for job not found
      if (
        wrapped.message.toLowerCase().includes('not found') ||
        wrapped.message.toLowerCase().includes('no test') ||
        wrapped.message.toLowerCase().includes('invalid')
      ) {
        throw new SfError(`Job ID '${flags['job-id'] ?? 'most recent'}' not found.`, 'JobNotFound', [], 2, wrapped);
      }

      throw wrapped;
    }

    this.mso = new TestStages({
      title: `Agent Test Run: ${name ?? runId}`,
      jsonEnabled: this.jsonEnabled(),
    });
    this.mso.start({ id: runId });
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));

    let completed;
    let response;
    try {
      const pollResult = await this.mso.poll(agentTester, runId, flags.wait);
      completed = pollResult.completed;
      response = pollResult.response;
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        `Failed to poll test results: ${wrapped.message}`,
        'TestPollFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

    if (completed) await agentTestCache.removeCacheEntry(runId);

    this.mso.stop();

    await handleTestResults({
      id: runId,
      format: resultFormat ?? flags['result-format'],
      results: response,
      jsonEnabled: this.jsonEnabled(),
      outputDir: outputDir ?? flags['output-dir'],
      verbose: flags.verbose,
    });

    // Set exit code to 1 only for execution errors (tests couldn't run properly)
    // Test assertion failures are business logic and should not affect exit code
    if (response?.testCases.some((tc) => tc.status === 'ERROR')) {
      process.exitCode = 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return { ...response!, runId, status: 'COMPLETED' };
  }

  protected catch(error: Error | SfError | CLIError): Promise<never> {
    this.mso?.error();
    return super.catch(error);
  }
}
