/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { colorize } from '@oclif/core/ux';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { AgentTester } from '@salesforce/agents';
import { Lifecycle } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { Ux } from '@salesforce/sf-plugins-core';

type Data = { id: string; status: string };

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

  public async poll(agentTester: AgentTester, id: string, wait: Duration): Promise<boolean> {
    this.mso.skipTo('Polling for Test Results');
    const lifecycle = Lifecycle.getInstance();
    lifecycle.on('AGENT_TEST_POLLING_EVENT', async (event: { status: string }) =>
      Promise.resolve(this.update({ status: event?.status }))
    );

    try {
      const { formatted } = await agentTester.poll(id, { timeout: wait });
      this.stop();
      this.ux.log(formatted);
      return true;
    } catch (e) {
      if (isTimeoutError(e)) {
        this.stop('async');
        this.ux.log(`Client timed out after ${wait.minutes} minutes.`);
        this.ux.log(`Run ${colorize('dim', `sf agent test resume --job-id ${id}`)} to resuming watching this test.`);
        return true;
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
