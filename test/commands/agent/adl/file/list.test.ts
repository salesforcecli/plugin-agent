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

  it('should return files from paginated /files endpoint', async () => {
    const mockResult = {
      files: [
        {
          fileId: '1Jc000001',
          fileName: 'doc.pdf',
          filePath: '$agentforce_data_library$/1JD000001/doc.pdf',
          fileSize: 1024,
          status: 'INDEXED',
        },
        {
          fileId: '1Jc000002',
          fileName: 'guide.txt',
          filePath: '$agentforce_data_library$/1JD000001/guide.txt',
          fileSize: 512,
          status: 'UPLOADED',
        },
      ],
      totalSize: 2,
      currentPageUrl: '/einstein/data-libraries/1JD000001/files?pageSize=50&offset=0',
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlFileList.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.files).to.have.lengthOf(2);
    expect(result.files[0].fileName).to.equal('doc.pdf');
    expect(result.files[0].status).to.equal('INDEXED');
    expect(result.files[1].fileName).to.equal('guide.txt');
    expect(result.totalSize).to.equal(2);
  });

  it('should return empty array when no files', async () => {
    const mockResult = {
      files: [],
      totalSize: 0,
      currentPageUrl: '/einstein/data-libraries/1JD000001/files?pageSize=50&offset=0',
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlFileList.run(['--target-org', testOrg.username, '--library-id', '1JD000001']);

    expect(result.files).to.have.lengthOf(0);
    expect(result.totalSize).to.equal(0);
  });

  it('should include nextPageUrl when more results exist', async () => {
    const mockResult = {
      files: [{ fileId: '1Jc000001', fileName: 'doc.pdf', filePath: 'path', fileSize: 1024, status: 'INDEXED' }],
      totalSize: 10,
      currentPageUrl: '/einstein/data-libraries/1JD000001/files?pageSize=1&offset=0',
      nextPageUrl: '/einstein/data-libraries/1JD000001/files?pageSize=1&offset=1',
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlFileList.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--page-size',
      '1',
    ]);

    expect(result.files).to.have.lengthOf(1);
    expect(result.totalSize).to.equal(10);
    expect(result.nextPageUrl).to.be.a('string');
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
