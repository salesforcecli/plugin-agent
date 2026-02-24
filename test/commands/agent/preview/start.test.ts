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

  describe('setMockMode', () => {
    it('should call setMockMode with "Mock" when --use-live-actions is not set', async () => {
      await AgentPreviewStart.run(['--authoring-bundle', 'MyAgent', '--target-org', 'test@org.com']);

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
  });
});
