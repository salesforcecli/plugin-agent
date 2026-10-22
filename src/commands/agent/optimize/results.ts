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
import { Messages, SfError } from '@salesforce/core';
import { AgentOptimization, type OptimizationResults } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.optimize.results');

export type AgentOptimizeResultsResult = OptimizationResults;

export default class AgentOptimizeResults extends SfCommand<AgentOptimizeResultsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'execution-id': Flags.string({
      summary: messages.getMessage('flags.execution-id.summary'),
      char: 'i',
      required: true,
    }),
  };

  public async run(): Promise<AgentOptimizeResultsResult> {
    const { flags } = await this.parse(AgentOptimizeResults);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: OptimizationResults;
    try {
      result = await AgentOptimization.results(connection, flags['execution-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      if (wrapped.message.includes('still running')) {
        throw new SfError(
          messages.getMessage('error.stillRunning', [flags['execution-id']]),
          'StillRunning',
          ['Use `sf agent optimize status` to check progress.'],
          4,
          wrapped
        );
      }
      throw new SfError(messages.getMessage('error.resultsFailed', [wrapped.message]), 'ResultsFailed', [], 4, wrapped);
    }

    this.log(`Execution: ${result.executionId}`);
    this.log(`Status: ${result.status}`);
    this.log(`Iterations: ${result.iterationsRun}`);
    this.log(
      `Baseline: ${result.baselineScore.toFixed(2)} → Final: ${result.finalScore.toFixed(
        2
      )} (Best: ${result.bestScore.toFixed(2)} at iteration ${result.bestIteration})`
    );

    if (result.iterationHistory?.length) {
      this.log('\nIteration History:');
      this.log('  #   Score   Gates');
      this.log('  --- ------- -----');
      for (const iter of result.iterationHistory) {
        const gates = iter.gatesPassed ? 'PASS' : 'FAIL';
        this.log(`  ${String(iter.iteration).padStart(3)}   ${iter.compositeScore.toFixed(3).padStart(7)}   ${gates}`);
      }
    }

    return result;
  }
}
