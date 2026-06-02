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
import AgentAdlFileDelete from '../../../../../src/commands/agent/adl/file/delete.js';

describe('agent adl file delete', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should delete a file and return success', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve({});

    const result = await AgentAdlFileDelete.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--file-id',
      '1Jc000001',
    ]);

    expect(result.success).to.be.true;
    expect(result.fileId).to.equal('1Jc000001');
  });

  it('should throw DeleteFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('File not found'));

    try {
      await AgentAdlFileDelete.run([
        '--target-org',
        testOrg.username,
        '--library-id',
        '1JD000001',
        '--file-id',
        '1Jc000001',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('DeleteFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
