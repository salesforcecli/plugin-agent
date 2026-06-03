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
import AgentAdlList from '../../../../src/commands/agent/adl/list.js';

describe('agent adl list', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should return libraries from the API', async () => {
    const mockLibraries = [
      {
        libraryId: '1JD000001',
        masterLabel: 'Test Lib',
        developerName: 'Test_Lib',
        sourceType: 'SFDRIVE',
        status: 'READY',
      },
    ];

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve({ libraries: mockLibraries });

    const result = await AgentAdlList.run(['--target-org', testOrg.username]);

    expect(result.libraries).to.deep.equal(mockLibraries);
  });

  it('should throw ListFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('Network error'));

    try {
      await AgentAdlList.run(['--target-org', testOrg.username]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('ListFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
