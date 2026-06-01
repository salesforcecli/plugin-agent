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
import AgentAdlGet from '../../../../src/commands/agent/adl/get.js';

describe('agent adl get', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should return library detail', async () => {
    const mockResult = {
      libraryId: '1JD000001',
      masterLabel: 'Test',
      developerName: 'Test',
      sourceType: 'SFDRIVE',
      status: 'READY',
      retrieverId: '1Cx000001',
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlGet.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.libraryId).to.equal('1JD000001');
    expect(result.sourceType).to.equal('SFDRIVE');
    expect(result.retrieverId).to.equal('1Cx000001');
  });

  it('should throw GetFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('Not found'));

    try {
      await AgentAdlGet.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('GetFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
