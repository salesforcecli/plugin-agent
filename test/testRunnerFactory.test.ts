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
import type { Connection } from '@salesforce/core';
import type { TestRunnerType } from '@salesforce/agents';
import type { createTestRunner as CreateTestRunnerFn } from '../src/testRunnerFactory.js';

type MockConnection = Pick<Connection, 'instanceUrl'>;

const makeMockConnection = (): MockConnection => ({ instanceUrl: 'https://test.salesforce.com' });

describe('testRunnerFactory', () => {
  let detectTestRunnerFromIdStub: sinon.SinonStub;
  let determineTestRunnerStub: sinon.SinonStub;
  let AgentTesterStub: sinon.SinonStub;
  let AgentTesterNGTStub: sinon.SinonStub;
  let createTestRunner: typeof CreateTestRunnerFn;

  beforeEach(async () => {
    detectTestRunnerFromIdStub = sinon.stub();
    determineTestRunnerStub = sinon.stub();
    AgentTesterStub = sinon.stub().returns({ type: 'testing-center' });
    AgentTesterNGTStub = sinon.stub().returns({ type: 'agentforce-studio' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const { createTestRunner: fn } = await esmock('../src/testRunnerFactory.js', {
      '@salesforce/agents': {
        AgentTester: AgentTesterStub,
        AgentTesterNGT: AgentTesterNGTStub,
        detectTestRunnerFromId: detectTestRunnerFromIdStub,
        determineTestRunner: determineTestRunnerStub,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    createTestRunner = fn as typeof CreateTestRunnerFn;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('explicit type', () => {
    it('should use agentforce-studio runner when explicitType is "agentforce-studio"', async () => {
      const connection = makeMockConnection() as Connection;
      const result = await createTestRunner(connection, 'agentforce-studio' as TestRunnerType);

      expect(result.type).to.equal('agentforce-studio');
      expect(AgentTesterNGTStub.calledOnce).to.be.true;
      expect(AgentTesterStub.called).to.be.false;
      expect(detectTestRunnerFromIdStub.called).to.be.false;
      expect(determineTestRunnerStub.called).to.be.false;
    });

    it('should use testing-center runner when explicitType is "testing-center"', async () => {
      const connection = makeMockConnection() as Connection;
      const result = await createTestRunner(connection, 'testing-center' as TestRunnerType);

      expect(result.type).to.equal('testing-center');
      expect(AgentTesterStub.calledOnce).to.be.true;
      expect(AgentTesterNGTStub.called).to.be.false;
      expect(detectTestRunnerFromIdStub.called).to.be.false;
      expect(determineTestRunnerStub.called).to.be.false;
    });
  });

  describe('runId-based detection', () => {
    it('should use agentforce-studio runner when runId detects agentforce-studio type', async () => {
      detectTestRunnerFromIdStub.returns('agentforce-studio');
      const connection = makeMockConnection() as Connection;
      const result = await createTestRunner(connection, undefined, undefined, '3A2xxxxxxxxxxxx');

      expect(result.type).to.equal('agentforce-studio');
      expect(AgentTesterNGTStub.calledOnce).to.be.true;
      expect(determineTestRunnerStub.called).to.be.false;
    });

    it('should use testing-center runner when runId detects testing-center type', async () => {
      detectTestRunnerFromIdStub.returns('testing-center');
      const connection = makeMockConnection() as Connection;
      const result = await createTestRunner(connection, undefined, undefined, '4KBxxxxxxxxxxxx');

      expect(result.type).to.equal('testing-center');
      expect(AgentTesterStub.calledOnce).to.be.true;
      expect(determineTestRunnerStub.called).to.be.false;
    });

    it('should fall through to determineTestRunner when runId detection returns null', async () => {
      detectTestRunnerFromIdStub.returns(null);
      determineTestRunnerStub.resolves('agentforce-studio');
      const connection = makeMockConnection() as Connection;

      await createTestRunner(connection, undefined, 'myTestDef', 'unknownId');

      expect(determineTestRunnerStub.calledOnce).to.be.true;
    });
  });

  describe('org metadata detection fallback', () => {
    it('should call determineTestRunner when no explicitType or runId', async () => {
      determineTestRunnerStub.resolves('agentforce-studio');
      const connection = makeMockConnection() as Connection;
      const result = await createTestRunner(connection, undefined, 'myTestDefinition');

      expect(determineTestRunnerStub.calledOnceWith(connection, 'myTestDefinition')).to.be.true;
      expect(result.type).to.equal('agentforce-studio');
      expect(AgentTesterNGTStub.calledOnce).to.be.true;
    });

    it('should call determineTestRunner with undefined testDefinitionName when not provided', async () => {
      determineTestRunnerStub.resolves('testing-center');
      const connection = makeMockConnection() as Connection;
      const result = await createTestRunner(connection);

      expect(determineTestRunnerStub.calledOnceWith(connection, undefined)).to.be.true;
      expect(result.type).to.equal('testing-center');
    });
  });

  describe('runner instantiation', () => {
    it('should pass connection to AgentTesterNGT', async () => {
      const connection = makeMockConnection() as Connection;
      await createTestRunner(connection, 'agentforce-studio' as TestRunnerType);

      expect(AgentTesterNGTStub.calledWithNew()).to.be.true;
      expect(AgentTesterNGTStub.firstCall.args[0]).to.equal(connection);
    });

    it('should pass connection to AgentTester', async () => {
      const connection = makeMockConnection() as Connection;
      await createTestRunner(connection, 'testing-center' as TestRunnerType);

      expect(AgentTesterStub.calledWithNew()).to.be.true;
      expect(AgentTesterStub.firstCall.args[0]).to.equal(connection);
    });

    it('should return the runner instance alongside the type', async () => {
      const mockRunnerInstance = { poll: sinon.stub() };
      AgentTesterNGTStub.returns(mockRunnerInstance);
      const connection = makeMockConnection() as Connection;

      const result = await createTestRunner(connection, 'agentforce-studio' as TestRunnerType);

      expect(result.runner).to.equal(mockRunnerInstance);
      expect(result.type).to.equal('agentforce-studio');
    });
  });
});
