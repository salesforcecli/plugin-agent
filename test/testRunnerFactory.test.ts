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

import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { SfError } from '@salesforce/core';
import type { Connection } from '@salesforce/core';
import type { TestRunnerType } from '@salesforce/agents';
import type { createTestRunner as CreateTestRunnerFn } from '../src/testRunnerFactory.js';

type MockConnection = Pick<Connection, 'instanceUrl'>;
const makeMockConnection = (): MockConnection => ({ instanceUrl: 'https://test.salesforce.com' });

describe('testRunnerFactory', () => {
  let createAgentTesterStub: sinon.SinonStub;
  let createTestRunner: typeof CreateTestRunnerFn;

  beforeEach(async () => {
    createAgentTesterStub = sinon.stub();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const { createTestRunner: fn } = await esmock('../src/testRunnerFactory.js', {
      '@salesforce/agents': {
        createAgentTester: createAgentTesterStub,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    createTestRunner = fn as typeof CreateTestRunnerFn;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('argument passthrough', () => {
    it('passes explicitType, runId, and testDefinitionName to createAgentTester', async () => {
      const mockResult = { runner: {}, type: 'agentforce-studio' as TestRunnerType };
      createAgentTesterStub.resolves(mockResult);
      const connection = makeMockConnection() as Connection;

      await createTestRunner(connection, 'agentforce-studio', 'myTest', '3A2xxx');

      expect(
        createAgentTesterStub.calledOnceWith(connection, {
          explicitType: 'agentforce-studio',
          runId: '3A2xxx',
          testDefinitionName: 'myTest',
        })
      ).to.be.true;
    });

    it('passes undefined fields when not provided', async () => {
      createAgentTesterStub.resolves({ runner: {}, type: 'testing-center' as TestRunnerType });
      const connection = makeMockConnection() as Connection;

      await createTestRunner(connection);

      expect(
        createAgentTesterStub.calledOnceWith(connection, {
          explicitType: undefined,
          runId: undefined,
          testDefinitionName: undefined,
        })
      ).to.be.true;
    });

    it('returns the result from createAgentTester', async () => {
      const mockRunner = { poll: sinon.stub() };
      const mockResult = { runner: mockRunner, type: 'agentforce-studio' as TestRunnerType };
      createAgentTesterStub.resolves(mockResult);
      const connection = makeMockConnection() as Connection;

      const result = await createTestRunner(connection, 'agentforce-studio');

      expect(result.runner).to.equal(mockRunner);
      expect(result.type).to.equal('agentforce-studio');
    });
  });

  describe('AmbiguousTestDefinition error handling', () => {
    it('re-throws with --test-runner action hint', async () => {
      const original = new SfError('MySuite exists in both metadata types', 'AmbiguousTestDefinition');
      createAgentTesterStub.rejects(original);
      const connection = makeMockConnection() as Connection;

      try {
        await createTestRunner(connection, undefined, 'MySuite');
        expect.fail('Expected error was not thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(SfError);
        const sfErr = err as SfError;
        expect(sfErr.name).to.equal('AmbiguousTestDefinition');
        expect(sfErr.actions).to.include(
          'Use --test-runner to explicitly specify the runner type (agentforce-studio or testing-center)'
        );
        expect(sfErr.cause).to.equal(original);
      }
    });

    it('passes through non-AmbiguousTestDefinition errors unchanged', async () => {
      const original = new SfError('Network error', 'NetworkError');
      createAgentTesterStub.rejects(original);
      const connection = makeMockConnection() as Connection;

      try {
        await createTestRunner(connection, undefined, 'MySuite');
        expect.fail('Expected error was not thrown');
      } catch (err) {
        expect(err).to.equal(original);
      }
    });
  });
});
