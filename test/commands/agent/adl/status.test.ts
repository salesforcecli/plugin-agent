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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { expect } from 'chai';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import AgentAdlStatus from '../../../../src/commands/agent/adl/status.js';

describe('agent adl status', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should return indexing status with stage details', async () => {
    const mockResult = {
      indexingStatus: {
        libraryId: '1JD000001',
        status: 'IN_PROGRESS',
        stageDetails: [
          { name: 'DATA_LAKE_OBJECT', status: 'SUCCESS', completedAt: 1_700_000_000_000 },
          { name: 'SEARCH_INDEX', status: 'IN_PROGRESS', startedAt: 1_700_000_001_000 },
        ],
      },
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlStatus.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.indexingStatus.libraryId).to.equal('1JD000001');
    expect(result.indexingStatus.status).to.equal('IN_PROGRESS');
    expect(result.indexingStatus.stageDetails).to.have.lengthOf(2);
  });

  it('should throw StatusFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('Timeout'));

    try {
      await AgentAdlStatus.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('StatusFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
