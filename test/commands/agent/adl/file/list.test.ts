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
import AgentAdlFileList from '../../../../../src/commands/agent/adl/file/list.js';

describe('agent adl file list', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should return files from groundingSource.groundingFileRefs', async () => {
    const mockResult = {
      libraryId: '1JD000001',
      groundingSource: {
        groundingFileRefs: [
          {
            fileId: '1Jc000001',
            fileName: 'doc.pdf',
            filePath: '$agentforce_data_library$/1JD000001/doc.pdf',
            fileSize: 1024,
          },
          {
            fileId: '1Jc000002',
            fileName: 'guide.txt',
            filePath: '$agentforce_data_library$/1JD000001/guide.txt',
            fileSize: 512,
          },
        ],
      },
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlFileList.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.files).to.have.lengthOf(2);
    expect(result.files[0].fileName).to.equal('doc.pdf');
    expect(result.files[1].fileName).to.equal('guide.txt');
  });

  it('should return empty array when no files', async () => {
    const mockResult = {
      libraryId: '1JD000001',
      groundingSource: { groundingFileRefs: [] },
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlFileList.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.files).to.have.lengthOf(0);
  });

  it('should handle missing groundingSource gracefully', async () => {
    const mockResult = { libraryId: '1JD000001' };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlFileList.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.files).to.have.lengthOf(0);
  });

  it('should throw ListFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('Not found'));

    try {
      await AgentAdlFileList.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('ListFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
