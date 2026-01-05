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
import { AgentTester } from '@salesforce/agents';
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

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestResume);

    const agentTestCache = await AgentTestCache.create();
    const { name, runId, outputDir, resultFormat } = agentTestCache.useIdOrMostRecent(
      flags['job-id'],
      flags['use-most-recent']
    );

    const mso = new TestStages({
      title: `Agent Test Run: ${name ?? runId}`,
      jsonEnabled: this.jsonEnabled(),
    });
    mso.start({ id: runId });
    const agentTester = new AgentTester(flags['target-org'].getConnection(flags['api-version']));

    const { completed, response } = await mso.poll(agentTester, runId, flags.wait);
    if (completed) await agentTestCache.removeCacheEntry(runId);

    mso.stop();

    await handleTestResults({
      id: runId,
      format: resultFormat ?? flags['result-format'],
      results: response,
      jsonEnabled: this.jsonEnabled(),
      outputDir: outputDir ?? flags['output-dir'],
      verbose: flags.verbose,
    });

    return { ...response!, runId, status: 'COMPLETED' };
  }
}
