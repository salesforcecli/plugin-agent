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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';

const MOCK_PROJECT_DIR = join(process.cwd(), 'test', 'mock-projects', 'agent-generate-template');

describe('agent preview start', () => {
  const $$ = new TestContext();
  let setMockModeStub: sinon.SinonStub;
  let initStub: sinon.SinonStub;
  let createCacheStub: sinon.SinonStub;
  let AgentPreviewStart: any;

  beforeEach(async () => {
    setMockModeStub = $$.SANDBOX.stub();
    const mockPreview = {
      setMockMode: setMockModeStub,
      start: $$.SANDBOX.stub().resolves({ sessionId: 'test-session-id' }),
    };
    class MockScriptAgent {
      public preview = mockPreview;
      public name = 'TestAgent';
    }
    const mockAgent = new MockScriptAgent();
    initStub = $$.SANDBOX.stub().resolves(mockAgent);
    createCacheStub = $$.SANDBOX.stub().resolves();

    const mod = await esmock('../../../../src/commands/agent/preview/start.js', {
      '@salesforce/agents': {
        Agent: { init: initStub },
        ScriptAgent: MockScriptAgent,
        ProductionAgent: class ProductionAgent {},
      },
      '../../../../src/previewSessionStore.js': {
        createCache: createCacheStub,
      },
    });

    AgentPreviewStart = mod.default;

    $$.inProject(true);

    const mockProject = {
      getPath: () => MOCK_PROJECT_DIR,
      getDefaultPackage: () => ({
        fullPath: join(MOCK_PROJECT_DIR, 'force-app'),
      }),
    } as unknown as SfProject;

    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('--agent-json flag', () => {
    const mockAgentJson = {
      schemaVersion: '1.0',
      globalConfiguration: {
        developerName: 'TestAgent',
        label: 'Test Agent',
        description: '',
        enableEnhancedEventLogs: false,
        agentType: 'AgentforceServiceAgent',
        templateName: '',
        defaultAgentUser: 'test@user.com',
        defaultOutboundRouting: '',
        contextVariables: [],
      },
      agentVersion: {
        developerName: null,
        plannerType: 'ReAct',
        systemMessages: [],
        modalityParameters: { voice: {}, language: {} },
        additionalParameters: false,
        company: 'Test',
        role: 'Assistant',
        stateVariables: [],
        initialNode: 'start',
        nodes: [],
        knowledgeDefinitions: null,
      },
    };
    let agentJsonInitStub: sinon.SinonStub;
    let AgentPreviewStartWithFileFlag: any;
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'agent-json-test-'));

      const mockPreview = {
        setMockMode: $$.SANDBOX.stub(),
        start: $$.SANDBOX.stub().resolves({ sessionId: 'test-session-id' }),
      };
      class MockScriptAgent {
        public preview = mockPreview;
        public name = 'TestAgent';
      }
      agentJsonInitStub = $$.SANDBOX.stub().resolves(new MockScriptAgent());

      const mod = await esmock('../../../../src/commands/agent/preview/start.js', {
        '@salesforce/agents': {
          Agent: { init: agentJsonInitStub },
          ScriptAgent: MockScriptAgent,
          ProductionAgent: class ProductionAgent {},
        },
        '../../../../src/previewSessionStore.js': {
          createCache: $$.SANDBOX.stub().resolves(),
        },
      });
      AgentPreviewStartWithFileFlag = mod.default;
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('reads the file and passes parsed agentJson to Agent.init', async () => {
      const agentJsonPath = join(tmpDir, 'agent.json');
      writeFileSync(agentJsonPath, JSON.stringify(mockAgentJson));

      await AgentPreviewStartWithFileFlag.run([
        '--authoring-bundle',
        'MyAgent',
        '--simulate-actions',
        '--target-org',
        'test@org.com',
        '--agent-json',
        agentJsonPath,
      ]);

      expect(agentJsonInitStub.calledOnce).to.be.true;
      const initArg = agentJsonInitStub.firstCall.args[0];
      expect(initArg).to.have.property('agentJson');
      expect(initArg.agentJson).to.deep.equal(mockAgentJson);
    });

    it('throws AgentJsonReadError when file contains invalid JSON', async () => {
      const badJsonPath = join(tmpDir, 'bad.json');
      writeFileSync(badJsonPath, 'not-valid-json{{{');

      try {
        await AgentPreviewStartWithFileFlag.run([
          '--authoring-bundle',
          'MyAgent',
          '--simulate-actions',
          '--target-org',
          'test@org.com',
          '--agent-json',
          badJsonPath,
        ]);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('Failed to read or parse --agent-json file');
      }
    });
  });

  describe('setMockMode', () => {
    it('should call setMockMode with "Mock" when --simulate-actions is set', async () => {
      await AgentPreviewStart.run([
        '--authoring-bundle',
        'MyAgent',
        '--simulate-actions',
        '--target-org',
        'test@org.com',
      ]);

      expect(setMockModeStub.calledOnce).to.be.true;
      expect(setMockModeStub.firstCall.args[0]).to.equal('Mock');
    });

    it('should call setMockMode with "Live Test" when --use-live-actions is set', async () => {
      await AgentPreviewStart.run([
        '--authoring-bundle',
        'MyAgent',
        '--use-live-actions',
        '--target-org',
        'test@org.com',
      ]);

      expect(setMockModeStub.calledOnce).to.be.true;
      expect(setMockModeStub.firstCall.args[0]).to.equal('Live Test');
    });

    it('should throw error when using --authoring-bundle without mode flag', async () => {
      try {
        await AgentPreviewStart.run(['--authoring-bundle', 'MyAgent', '--target-org', 'test@org.com']);
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('must specify either --use-live-actions or --simulate-actions');
      }
    });

    it('should throw error when using both mode flags together', async () => {
      try {
        await AgentPreviewStart.run([
          '--authoring-bundle',
          'MyAgent',
          '--use-live-actions',
          '--simulate-actions',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect((error as Error).message).to.match(/cannot also be provided when using/i);
      }
    });

    it('should throw error when neither --api-name nor --authoring-bundle is provided', async () => {
      try {
        await AgentPreviewStart.run(['--use-live-actions', '--target-org', 'test@org.com']);
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        expect((error as Error).message).to.match(/exactly one|api-name|authoring-bundle/i);
      }
    });
  });
});
