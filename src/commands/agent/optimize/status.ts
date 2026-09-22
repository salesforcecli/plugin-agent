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
import { AgentOptimization, type OptimizationStatus } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.optimize.status');

export type AgentOptimizeStatusResult = OptimizationStatus;

export default class AgentOptimizeStatus extends SfCommand<AgentOptimizeStatusResult> {
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

  public async run(): Promise<AgentOptimizeStatusResult> {
    const { flags } = await this.parse(AgentOptimizeStatus);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: OptimizationStatus;
    try {
      result = await AgentOptimization.status(connection, flags['execution-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.statusFailed', [wrapped.message]), 'StatusFailed', [], 4, wrapped);
    }

    this.log(`Execution: ${result.executionId}`);
    this.log(`Status: ${result.status}`);
    if (result.currentIteration != null && result.maxIterations != null) {
      this.log(`Progress: ${result.currentIteration}/${result.maxIterations} iterations`);
    }
    const parts: string[] = [];
    if (result.baselineScore != null) parts.push(`Baseline: ${result.baselineScore.toFixed(2)}`);
    if (result.currentScore != null) parts.push(`Current: ${result.currentScore.toFixed(2)}`);
    if (result.bestScore != null) {
      let best = `Best: ${result.bestScore.toFixed(2)}`;
      if (result.bestIteration != null) best += ` (iteration ${result.bestIteration})`;
      parts.push(best);
    }
    if (parts.length > 0) this.log(parts.join('  '));
    if (result.message) this.log(result.message);

    return result;
  }
}
