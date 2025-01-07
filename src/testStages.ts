/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { colorize } from '@oclif/core/ux';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { AgentTestResultsResponse, AgentTester } from '@salesforce/agents';
import { Lifecycle } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { Ux } from '@salesforce/sf-plugins-core';

type Data = {
  id: string;
  status: string;
  totalTestCases: number;
  passingTestCases: number;
  failingTestCases: number;
};

const isTimeoutError = (e: unknown): e is { name: 'PollingClientTimeout' } =>
  (e as { name: string })?.name === 'PollingClientTimeout';

export class TestStages {
  private mso: MultiStageOutput<Data>;
  private ux: Ux;

  public constructor({ title, jsonEnabled }: { title: string; jsonEnabled: boolean }) {
    this.ux = new Ux({ jsonEnabled });
    this.mso = new MultiStageOutput<Data>({
      title,
      jsonEnabled,
      stages: ['Starting Tests', 'Polling for Test Results'],
      stageSpecificBlock: [
        {
          stage: 'Polling for Test Results',
          type: 'dynamic-key-value',
          label: 'Status',
          get: (data): string | undefined => data?.status,
        },
        {
          stage: 'Polling for Test Results',
          type: 'dynamic-key-value',
          label: 'Completed Test Cases',
          get: (data): string | undefined =>
            data?.totalTestCases && data?.passingTestCases && data?.failingTestCases
              ? `${data?.passingTestCases + data?.failingTestCases}/${data?.totalTestCases}`
              : undefined,
        },
        {
          stage: 'Polling for Test Results',
          type: 'dynamic-key-value',
          label: 'Passing Test Cases',
          get: (data): string | undefined => data?.passingTestCases?.toString(),
        },
        {
          stage: 'Polling for Test Results',
          type: 'dynamic-key-value',
          label: 'Failing Test Cases',
          get: (data): string | undefined => data?.failingTestCases?.toString(),
        },
      ],
      postStagesBlock: [
        {
          type: 'dynamic-key-value',
          label: 'Job ID',
          get: (data): string | undefined => data?.id,
        },
      ],
    });
  }

  public start(data?: Partial<Data>): void {
    this.mso.skipTo('Starting Tests', data);
  }

  public async poll(
    agentTester: AgentTester,
    id: string,
    wait: Duration
  ): Promise<{ completed: boolean; response?: AgentTestResultsResponse }> {
    this.mso.skipTo('Polling for Test Results');
    const lifecycle = Lifecycle.getInstance();
    lifecycle.on(
      'AGENT_TEST_POLLING_EVENT',
      async (event: {
        status: string;
        completedTestCases: number;
        totalTestCases: number;
        failingTestCases: number;
        passingTestCases: number;
      }) => Promise.resolve(this.update(event))
    );

    try {
      const response = await agentTester.poll(id, { timeout: wait });
      this.stop();
      return { completed: true, response };
    } catch (e) {
      if (isTimeoutError(e)) {
        this.stop('async');
        this.ux.log(`Client timed out after ${wait.minutes} minutes.`);
        this.ux.log(`Run ${colorize('dim', `sf agent test resume --job-id ${id}`)} to resuming watching this test.`);
        return { completed: true };
      } else {
        this.error();
        throw e;
      }
    }
  }

  public update(data: Partial<Data>): void {
    this.mso.updateData(data);
  }

  public stop(finalStatus?: 'async'): void {
    this.mso.stop(finalStatus);
  }

  public error(): void {
    this.mso.error();
  }

  public done(data?: Partial<Data>): void {
    this.mso.skipTo('Done', data);
  }
}
