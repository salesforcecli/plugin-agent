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
import AgentAdlCreate from '../../../../src/commands/agent/adl/create.js';

describe('agent adl create', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should create an SFDRIVE library', async () => {
    const mockResult = {
      libraryId: '1JD000001',
      masterLabel: 'Test',
      developerName: 'Test',
      sourceType: 'SFDRIVE',
      status: 'IN_PROGRESS',
    };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlCreate.run([
      '--target-org',
      testOrg.username,
      '--name',
      'Test',
      '--developer-name',
      'Test',
      '--source-type',
      'sfdrive',
    ]);

    expect(result.libraryId).to.equal('1JD000001');
  });

  it('should require primary-index-field1 and field2 for KNOWLEDGE', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);

    try {
      await AgentAdlCreate.run([
        '--target-org',
        testOrg.username,
        '--name',
        'Test',
        '--developer-name',
        'Test',
        '--source-type',
        'knowledge',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string };
      expect(error.name).to.equal('MissingKnowledgeFields');
    }
  });

  it('should require retriever-id for RETRIEVER', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);

    try {
      await AgentAdlCreate.run([
        '--target-org',
        testOrg.username,
        '--name',
        'Test',
        '--developer-name',
        'Test',
        '--source-type',
        'retriever',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string };
      expect(error.name).to.equal('MissingRetrieverId');
    }
  });

  it('should create a KNOWLEDGE library with index fields', async () => {
    const mockResult = {
      libraryId: '1JD000002',
      masterLabel: 'KB',
      developerName: 'KB',
      sourceType: 'KNOWLEDGE',
      status: 'IN_PROGRESS',
    };
    let capturedBody: string | undefined;

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = (request: { body?: string; method?: string }) => {
      if (request.method === 'POST' && request.body && !capturedBody) {
        capturedBody = request.body;
      }
      return Promise.resolve(mockResult);
    };

    const result = await AgentAdlCreate.run([
      '--target-org',
      testOrg.username,
      '--name',
      'KB',
      '--developer-name',
      'KB',
      '--source-type',
      'knowledge',
      '--primary-index-field1',
      'ArticleNumber',
      '--primary-index-field2',
      'Title',
    ]);

    expect(result.libraryId).to.equal('1JD000002');
    const body = JSON.parse(capturedBody!);
    expect(body.groundingSource.sourceType).to.equal('KNOWLEDGE');
    expect(body.groundingSource.knowledgeConfig.primaryIndexField1).to.equal('ArticleNumber');
    expect(body.groundingSource.knowledgeConfig.primaryIndexField2).to.equal('Title');
  });

  it('should throw CreateFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('Server error'));

    try {
      await AgentAdlCreate.run([
        '--target-org',
        testOrg.username,
        '--name',
        'Test',
        '--developer-name',
        'Test',
        '--source-type',
        'sfdrive',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('CreateFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
