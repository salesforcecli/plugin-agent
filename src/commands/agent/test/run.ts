/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { AgentTester, AgentTestStartResponse } from '@salesforce/agents';
import { colorize } from '@oclif/core/ux';
import { CLIError } from '@oclif/core/errors';
import {
  AgentTestRunResult,
  FlaggablePrompt,
  makeFlags,
  promptForAiEvaluationDefinitionApiName,
  resultFormatFlag,
  testOutputDirFlag,
} from '../../../flags.js';
import { AgentTestCache } from '../../../agentTestCache.js';
import { TestStages } from '../../../testStages.js';
import { handleTestResults } from '../../../handleTestResults.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

const FLAGGABLE_PROMPTS = {
  'api-name': {
    char: 'n',
    required: true,
    message: messages.getMessage('flags.api-name.summary'),
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
  };

  private mso: TestStages | undefined;

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestRun);
    const connection = flags['target-org'].getConnection(flags['api-version']);
    const apiName =
      flags['api-name'] ?? (await promptForAiEvaluationDefinitionApiName(FLAGGABLE_PROMPTS['api-name'], connection));

    this.mso = new TestStages({ title: `Agent Test Run: ${apiName}`, jsonEnabled: this.jsonEnabled() });
    this.mso.start();

    const agentTester = new AgentTester(connection);
    let response: AgentTestStartResponse;
    try {
      response = await agentTester.start(apiName);
    } catch (e) {
      const wrapped = SfError.wrap(e);
      if (wrapped.message.includes('Invalid AiEvalDefinitionVersion identifier')) {
        wrapped.actions = [
          `Try running "sf agent test list -o ${flags['target-org'].getUsername() ?? ''}" to see available options`,
        ];
      }
      throw wrapped;
    }

    this.mso.update({ id: response.runId });

    const agentTestCache = await AgentTestCache.create();
    await agentTestCache.createCacheEntry(response.runId, apiName, flags['output-dir'], flags['result-format']);

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

      return { ...detailsResponse!, status: 'COMPLETED', runId: response.runId };
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
