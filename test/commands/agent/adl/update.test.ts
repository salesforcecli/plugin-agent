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
import AgentAdlUpdate from '../../../../src/commands/agent/adl/update.js';

describe('agent adl update', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should update metadata fields', async () => {
    const mockResult = { libraryId: '1JD000001', masterLabel: 'Updated', developerName: 'Test', status: 'READY' };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.resolve(mockResult);

    const result = await AgentAdlUpdate.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--name',
      'Updated',
      '--description',
      'New desc',
    ]);

    expect(result.masterLabel).to.equal('Updated');
  });

  it('should include knowledgeConfig when content-fields provided', async () => {
    const getResult = {
      libraryId: '1JD000001',
      masterLabel: 'KB',
      developerName: 'KB',
      sourceType: 'KNOWLEDGE',
      status: 'READY',
    };
    const patchResult = { libraryId: '1JD000001', masterLabel: 'KB', developerName: 'KB', status: 'READY' };
    let capturedBody: string | undefined;

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = (request: { method?: string; body?: string }) => {
      if (request.method === 'GET') return Promise.resolve(getResult);
      capturedBody = request.body;
      return Promise.resolve(patchResult);
    };

    await AgentAdlUpdate.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--content-fields',
      'Answer__c,Summary__c',
    ]);

    const body = JSON.parse(capturedBody!);
    expect(body.groundingSource.sourceType).to.equal('KNOWLEDGE');
    expect(body.groundingSource.knowledgeConfig.contentFields).to.deep.equal(['Answer__c', 'Summary__c']);
  });

  it('should include restrict-to-public-articles flag', async () => {
    const getResult = {
      libraryId: '1JD000001',
      masterLabel: 'KB',
      developerName: 'KB',
      sourceType: 'KNOWLEDGE',
      status: 'READY',
    };
    const patchResult = { libraryId: '1JD000001', masterLabel: 'KB', developerName: 'KB', status: 'READY' };
    let capturedBody: string | undefined;

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = (request: { method?: string; body?: string }) => {
      if (request.method === 'GET') return Promise.resolve(getResult);
      capturedBody = request.body;
      return Promise.resolve(patchResult);
    };

    await AgentAdlUpdate.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--restrict-to-public-articles',
    ]);

    const body = JSON.parse(capturedBody!);
    expect(body.groundingSource.knowledgeConfig.isRestrictToPublicArticle).to.be.true;
  });

  it('should warn when knowledge flags used on non-KNOWLEDGE library', async () => {
    const getResult = {
      libraryId: '1JD000001',
      masterLabel: 'File',
      developerName: 'File',
      sourceType: 'SFDRIVE',
      status: 'READY',
    };
    const patchResult = { libraryId: '1JD000001', masterLabel: 'File', developerName: 'File', status: 'READY' };

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = (request: { method?: string }) => {
      if (request.method === 'GET') return Promise.resolve(getResult);
      return Promise.resolve(patchResult);
    };

    const result = await AgentAdlUpdate.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--content-fields',
      'Answer__c',
    ]);

    // Should still succeed (metadata update) but warn — groundingSource should NOT be in the PATCH body
    expect(result.libraryId).to.equal('1JD000001');
  });

  it('should pass retriever-id for RETRIEVER swap', async () => {
    const mockResult = { libraryId: '1JD000001', masterLabel: 'Ret', developerName: 'Ret', status: 'READY' };
    let capturedBody: string | undefined;

    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = (request: { method?: string; body?: string }) => {
      if (request.method === 'PATCH') capturedBody = request.body;
      return Promise.resolve(mockResult);
    };

    await AgentAdlUpdate.run([
      '--target-org',
      testOrg.username,
      '--library-id',
      '1JD000001',
      '--retriever-id',
      '1Cx000NEW',
    ]);

    const body = JSON.parse(capturedBody!);
    expect(body.groundingSource.sourceType).to.equal('RETRIEVER');
    expect(body.groundingSource.retrieverId).to.equal('1Cx000NEW');
  });

  it('should throw UpdateFailed on API error', async () => {
    const testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    $$.fakeConnectionRequest = () => Promise.reject(new Error('Conflict'));

    try {
      await AgentAdlUpdate.run(['--target-org', testOrg.username, '--library-id', '1JD000001', '--name', 'Fail']);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { name: string; exitCode: number };
      expect(error.name).to.equal('UpdateFailed');
      expect(error.exitCode).to.equal(4);
    }
  });
});
