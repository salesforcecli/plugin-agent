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
import { readFile } from 'node:fs/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { AgentOptimization, type OptimizationExecution, type OptimizationStatus } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.optimize.start');

export type AgentOptimizeStartResult = {
  executionId: string;
  status: string;
  baselineScore?: number;
  bestScore?: number;
  iterationsRun?: number;
};

export default class AgentOptimizeStart extends SfCommand<AgentOptimizeStartResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = true;
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      char: 'b',
      required: true,
    }),
    criteria: Flags.file({
      summary: messages.getMessage('flags.criteria.summary'),
      char: 'c',
      required: true,
      exists: true,
    }),
    'test-cases': Flags.file({
      summary: messages.getMessage('flags.test-cases.summary'),
      exists: true,
    }),
    'max-iterations': Flags.integer({
      summary: messages.getMessage('flags.max-iterations.summary'),
      default: 10,
    }),
    'target-score': Flags.string({
      summary: messages.getMessage('flags.target-score.summary'),
      default: '1.0',
    }),
    wait: Flags.integer({
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
      char: 'w',
    }),
  };

  public async run(): Promise<AgentOptimizeStartResult> {
    const { flags } = await this.parse(AgentOptimizeStart);
    const connection = flags['target-org'].getConnection(flags['api-version']);

    let criteriaJson: string;
    try {
      criteriaJson = await readFile(flags.criteria, 'utf-8');
    } catch (e) {
      throw new SfError(messages.getMessage('error.criteriaNotFound', [(e as Error).message]));
    }

    let testCasesJson: string | undefined;
    if (flags['test-cases']) {
      try {
        testCasesJson = await readFile(flags['test-cases'], 'utf-8');
      } catch (e) {
        throw new SfError(messages.getMessage('error.invalidCriteria', [(e as Error).message]));
      }
    }

    let execution: OptimizationExecution;
    try {
      execution = await AgentOptimization.start(connection, {
        authoringBundleName: flags['authoring-bundle'],
        criteriaJson,
        testCasesJson,
        maxIterations: flags['max-iterations'],
        targetScore: parseFloat(flags['target-score']),
      });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.startFailed', [wrapped.message]), 'StartFailed', [], 4, wrapped);
    }

    this.log(messages.getMessage('output.started', [execution.executionId]));

    if (!flags.wait) {
      return { executionId: execution.executionId, status: 'NEW' };
    }

    const pollIntervalMs = 10_000;
    const deadlineMs = Date.now() + flags.wait * 60_000;

    while (Date.now() < deadlineMs) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(pollIntervalMs);

      let status: OptimizationStatus;
      try {
        // eslint-disable-next-line no-await-in-loop
        status = await AgentOptimization.status(connection, execution.executionId);
      } catch (error) {
        const wrapped = SfError.wrap(error);
        throw new SfError(messages.getMessage('error.pollFailed', [wrapped.message]), 'PollFailed', [], 4, wrapped);
      }

      if (status.currentIteration != null && status.maxIterations != null) {
        this.log(
          messages.getMessage('output.progress', [
            String(status.currentIteration),
            String(status.maxIterations),
            status.baselineScore?.toFixed(2) ?? '-',
            status.currentScore?.toFixed(2) ?? '-',
            status.bestScore?.toFixed(2) ?? '-',
          ])
        );
      }

      if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'STOPPED_EARLY') {
        this.log(
          messages.getMessage('output.completed', [
            String(status.currentIteration ?? 0),
            status.baselineScore?.toFixed(2) ?? '-',
            status.bestScore?.toFixed(2) ?? '-',
          ])
        );
        return {
          executionId: execution.executionId,
          status: status.status,
          baselineScore: status.baselineScore,
          bestScore: status.bestScore,
          iterationsRun: status.currentIteration,
        };
      }
    }

    this.log(messages.getMessage('output.timeout', [String(flags.wait), execution.executionId]));
    return { executionId: execution.executionId, status: 'TIMEOUT' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
