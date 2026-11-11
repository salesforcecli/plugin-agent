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
import { AgentOptimization, type OptimizationAcceptResult } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.optimize.accept');

export type AgentOptimizeAcceptResult = OptimizationAcceptResult;

export default class AgentOptimizeAccept extends SfCommand<AgentOptimizeAcceptResult> {
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

  public async run(): Promise<AgentOptimizeAcceptResult> {
    const { flags } = await this.parse(AgentOptimizeAccept);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let result: OptimizationAcceptResult;
    try {
      result = await AgentOptimization.accept(connection, flags['execution-id']);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.acceptFailed', [wrapped.message]), 'AcceptFailed', [], 4, wrapped);
    }

    if (result.published) {
      this.log(`Optimization ${result.executionId} accepted and published.`);
    } else {
      this.log(`Optimization ${result.executionId}: ${result.message}`);
    }

    return result;
  }
}
