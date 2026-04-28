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
import { AgentTestStartResponse, AgentTestNGTStartResponse } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { CLIError } from '@oclif/core/errors';
import {
  AgentTestRunResult,
  FlaggablePrompt,
  makeFlags,
  promptForAiEvaluationDefinitionApiName,
  resultFormatFlag,
  testOutputDirFlag,
  testRunnerTypeFlag,
  verboseFlag,
} from '../../../flags.js';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';
import { handleTestResults } from '../../../handleTestResults.js';
import { createTestRunner } from '../../../testRunnerFactory.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

const FLAGGABLE_PROMPTS = {
  'api-name': {
    char: 'n',
    required: true,
    message: messages.getMessage('flags.api-name.summary'),
    promptMessage: messages.getMessage('flags.api-name.prompt'),
    validate: (d: string): boolean | string => {
      if (d.length === 0) {
        return true;
      }
      if (d.length > 80) {
        return 'API name cannot be over 80 characters.';
      }
      const regex = /^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]+$/;
      if (!regex.test(d)) {
        return 'Invalid API name.';
      }
      return true;
    },
  },
} satisfies Record<string, FlaggablePrompt>;

export default class AgentTestRun extends SfCommand<AgentTestRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Test started successfully (without --wait), or test completed successfully (with --wait).',
    'Failed (1)': 'Tests encountered execution errors (test cases with ERROR status when using --wait).',
    'NotFound (2)': 'Test definition not found or invalid test name.',
    'OperationFailed (4)': 'Failed to start or poll test due to API or network errors.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    ...makeFlags(FLAGGABLE_PROMPTS),
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
    'test-runner': testRunnerTypeFlag,
    verbose: verboseFlag,
  };

  private mso: TestStages | undefined;

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestRun);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    if (this.jsonEnabled() && !flags['api-name']) {
      throw messages.createError('error.missingRequiredFlags', ['api-name']);
    }

    const apiName =
      flags['api-name'] ?? (await promptForAiEvaluationDefinitionApiName(FLAGGABLE_PROMPTS['api-name'], connection));

    this.mso = new TestStages({ title: `Agent Test Run: ${apiName}`, jsonEnabled: this.jsonEnabled() });
    this.mso.start();

    // Determine which test runner to use (NGT or legacy)
    const result = await createTestRunner(connection, flags['test-runner'], apiName);
    const agentTester = result.runner;
    const runnerType = result.type;

    let response: AgentTestStartResponse | AgentTestNGTStartResponse;
    try {
      response = await agentTester.start(apiName);
    } catch (e) {
      const wrapped = SfError.wrap(e);

      // Check for test definition not found
      if (
        wrapped.message.includes('Invalid AiEvalDefinitionVersion identifier') ||
        wrapped.message.toLowerCase().includes('not found')
      ) {
        throw new SfError(
          `Test definition '${apiName}' not found.`,
          'TestNotFound',
          [`Try running "sf agent test list -o ${flags['target-org'].getUsername() ?? ''}" to see available options`],
          2,
          wrapped
        );
      }

      // API/network failures
      throw new SfError(`Failed to start test: ${wrapped.message}`, 'TestStartFailed', [wrapped.message], 4, wrapped);
    }

    this.mso.update({ id: response.runId });

    const agentTestCache = await AgentTestCache.create();
    await agentTestCache.createCacheEntry(
      response.runId,
      apiName,
      flags['output-dir'],
      flags['result-format'],
      runnerType
    );

    if (flags.wait?.minutes) {
      let completed;
      let detailsResponse;
      try {
        const pollResult = await this.mso.poll(agentTester, response.runId, flags.wait);
        completed = pollResult.completed;
        detailsResponse = pollResult.response;
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

      if (completed) await agentTestCache.removeCacheEntry(response.runId);

      this.mso.stop();

      await handleTestResults({
        id: response.runId,
        format: flags['result-format'],
        results: detailsResponse,
        jsonEnabled: this.jsonEnabled(),
        outputDir: flags['output-dir'],
        verbose: flags.verbose,
      });

      // Set exit code to 1 only for execution errors (tests couldn't run properly)
      // Test assertion failures are business logic and should not affect exit code
      // Only applicable to legacy responses (NGT doesn't have test case status)
      if (
        detailsResponse &&
        'subjectName' in detailsResponse &&
        detailsResponse.testCases.some((tc) => 'status' in tc && tc.status === 'ERROR')
      ) {
        process.exitCode = 1;
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      return { ...detailsResponse!, status: 'COMPLETED', runId: response.runId } as AgentTestRunResult;
    } else {
      this.mso.stop();
      this.log(
        `Run ${colorize('dim', `sf agent test resume --job-id ${response.runId}`)} to resuming watching this test.`
      );
    }

    return { status: 'NEW', runId: response.runId };
  }

  protected catch(error: Error | SfError | CLIError): Promise<never> {
    this.mso?.error();
    return super.catch(error);
  }
}
