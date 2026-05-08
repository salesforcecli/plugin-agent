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
const SESSION_ID = 'test-session-123';
const AGENT_ID = 'my_agent_id';
const TRACES_PATH = `/mock/.sfdx/agents/${AGENT_ID}/sessions/${SESSION_ID}`;

describe('agent preview end', () => {
  const $$ = new TestContext();
  let AgentPreviewEnd: any;
  let initStub: sinon.SinonStub;
  let getCachedSessionIdsStub: sinon.SinonStub;
  let listCachedSessionsStub: sinon.SinonStub;
  let removeCacheStub: sinon.SinonStub;
  let validatePreviewSessionStub: sinon.SinonStub;
  let confirmStub: sinon.SinonStub;
  let agentPreviewEndStub: sinon.SinonStub;

  beforeEach(async () => {
    agentPreviewEndStub = $$.SANDBOX.stub().resolves();
    getCachedSessionIdsStub = $$.SANDBOX.stub().resolves([SESSION_ID]);
    listCachedSessionsStub = $$.SANDBOX.stub().resolves([]);
    removeCacheStub = $$.SANDBOX.stub().resolves();
    validatePreviewSessionStub = $$.SANDBOX.stub().resolves();
    confirmStub = $$.SANDBOX.stub().resolves(true);

    const MockScriptAgent = class MockScriptAgent {
      public preview = { end: agentPreviewEndStub };
      public name = 'TestAgent';
      public setSessionId = sinon.stub();
      public getHistoryDir = sinon.stub().resolves(TRACES_PATH);
      public getAgentIdForStorage = sinon.stub().returns(AGENT_ID);
    };
    const MockProductionAgent = class MockProductionAgent {};

    const mockAgentInstance = new MockScriptAgent();
    initStub = $$.SANDBOX.stub().resolves(mockAgentInstance);

    const mod = await esmock('../../../../src/commands/agent/preview/end.js', {
      '@salesforce/agents': {
        Agent: { init: initStub },
        ScriptAgent: MockScriptAgent,
        ProductionAgent: MockProductionAgent,
      },
      '../../../../src/previewSessionStore.js': {
        getCachedSessionIds: getCachedSessionIdsStub,
        listCachedSessions: listCachedSessionsStub,
        removeCache: removeCacheStub,
        validatePreviewSession: validatePreviewSessionStub,
      },
      '@salesforce/sf-plugins-core': {
        Flags: (await import('@salesforce/sf-plugins-core')).Flags,
        SfCommand: (await import('@salesforce/sf-plugins-core')).SfCommand,
        toHelpSection: (await import('@salesforce/sf-plugins-core')).toHelpSection,
        prompts: {
          confirm: confirmStub,
        },
      },
    });

    AgentPreviewEnd = mod.default;

    $$.inProject(true);
    const mockProject = {
      getPath: () => MOCK_PROJECT_DIR,
      getDefaultPackage: () => ({ fullPath: join(MOCK_PROJECT_DIR, 'force-app') }),
    } as unknown as SfProject;
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('single-session end (default behaviour)', () => {
    it('ends a session for an authoring bundle using the cached session ID', async () => {
      const result = await AgentPreviewEnd.run([
        '--authoring-bundle',
        'My_Local_Agent',
        '--target-org',
        'test@org.com',
      ]);

      expect(initStub.calledOnce).to.be.true;
      expect(validatePreviewSessionStub.calledOnce).to.be.true;
      expect(removeCacheStub.calledOnce).to.be.true;
      expect(agentPreviewEndStub.calledOnce).to.be.true;
      expect(result).to.deep.include({ sessionId: SESSION_ID, tracesPath: TRACES_PATH });
    });

    it('ends a session with an explicit --session-id flag, skipping the cache lookup', async () => {
      const explicitSessionId = 'explicit-session-456';

      const result = await AgentPreviewEnd.run([
        '--authoring-bundle',
        'My_Local_Agent',
        '--session-id',
        explicitSessionId,
        '--target-org',
        'test@org.com',
      ]);

      expect(getCachedSessionIdsStub.called).to.be.false;
      expect(result).to.deep.include({ sessionId: explicitSessionId });
    });

    it('throws when no session is cached for the agent', async () => {
      getCachedSessionIdsStub.resolves([]);

      try {
        await AgentPreviewEnd.run(['--authoring-bundle', 'My_Local_Agent', '--target-org', 'test@org.com']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('No agent preview session found');
      }
    });

    it('throws when multiple sessions are cached for the agent', async () => {
      getCachedSessionIdsStub.resolves(['session-1', 'session-2']);

      try {
        await AgentPreviewEnd.run(['--authoring-bundle', 'My_Local_Agent', '--target-org', 'test@org.com']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('Multiple preview sessions found');
      }
    });

    it('throws when neither --api-name, --authoring-bundle, nor --all is provided', async () => {
      try {
        await AgentPreviewEnd.run(['--target-org', 'test@org.com']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.match(
          /exactly one of the following must be provided.*--api-name.*--authoring-bundle/is
        );
      }
    });

    it('throws when both --api-name and --authoring-bundle are provided at the same time', async () => {
      try {
        await AgentPreviewEnd.run([
          '--api-name',
          'My_Published_Agent',
          '--authoring-bundle',
          'My_Local_Agent',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.match(/--api-name.*cannot also be provided when using --authoring-bundle/i);
      }
    });

    it('throws when --session-id and --all are both provided', async () => {
      try {
        await AgentPreviewEnd.run([
          '--authoring-bundle',
          'My_Local_Agent',
          '--session-id',
          'sid',
          '--all',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.match(/cannot also be provided/i);
      }
    });
  });

  describe('--all flag: ends all cached sessions for the specified agent', () => {
    it('throws when --all is used without --target-org', async () => {
      try {
        await AgentPreviewEnd.run(['--all', '--authoring-bundle', 'My_Local_Agent']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('--target-org');
      }
    });

    it('filters to the specified agent when combined with --authoring-bundle', async () => {
      getCachedSessionIdsStub.resolves(['session-1', 'session-2']);

      const result = await AgentPreviewEnd.run([
        '--all',
        '--authoring-bundle',
        'My_Local_Agent',
        '--target-org',
        'test@org.com',
        '--no-prompt',
      ]);

      expect(initStub.calledOnce).to.be.true;
      expect(validatePreviewSessionStub.callCount).to.equal(2);
      expect(removeCacheStub.callCount).to.equal(2);
      expect((result as { ended: unknown[] }).ended).to.have.length(2);
    });

    it('filters to the specified agent when combined with --api-name and --target-org (happy path)', async () => {
      getCachedSessionIdsStub.resolves(['session-a', 'session-b']);

      const result = await AgentPreviewEnd.run([
        '--all',
        '--api-name',
        'My_Published_Agent',
        '--target-org',
        'test@org.com',
        '--no-prompt',
      ]);

      expect(initStub.calledOnce).to.be.true;
      expect(validatePreviewSessionStub.callCount).to.equal(2);
      expect(removeCacheStub.callCount).to.equal(2);
      expect((result as { ended: unknown[] }).ended).to.have.length(2);
    });

    it('throws when --all + --api-name is used without --target-org', async () => {
      try {
        await AgentPreviewEnd.run(['--all', '--api-name', 'My_Published_Agent']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('--target-org');
      }
    });

    it('logs a message and returns an empty list when no sessions are found', async () => {
      getCachedSessionIdsStub.resolves([]);

      const result = await AgentPreviewEnd.run([
        '--all',
        '--authoring-bundle',
        'My_Local_Agent',
        '--target-org',
        'test@org.com',
        '--no-prompt',
      ]);

      expect(result).to.deep.equal({ ended: [] });
      expect(removeCacheStub.called).to.be.false;
    });

    it('records partial results and throws a structured error when agent.preview.end() throws mid-loop', async () => {
      // Three sessions: session-1 succeeds, session-2 fails, session-3 succeeds
      getCachedSessionIdsStub.resolves(['session-1', 'session-2', 'session-3']);
      // Fail only on the second call (session-2)
      agentPreviewEndStub
        .onFirstCall()
        .resolves()
        .onSecondCall()
        .rejects(new Error('network timeout'))
        .onThirdCall()
        .resolves();

      try {
        await AgentPreviewEnd.run([
          '--all',
          '--authoring-bundle',
          'My_Local_Agent',
          '--target-org',
          'test@org.com',
          '--no-prompt',
        ]);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        const err = error as any;
        // Structured error: lists which sessions failed
        expect(err.message).to.include('Failed to end 1 session(s)');
        expect(err.message).to.include('session-2');
        expect(err.message).to.include('network timeout');
        // Also mentions the ones that succeeded
        expect(err.message).to.include('Successfully ended 2 session(s)');
        // 2 removes: session-1 (success), session-3 (success); session-2 fails so no cache removal
        expect(removeCacheStub.callCount).to.equal(2);
        expect(err.name).to.equal('PreviewEndPartialFailure');
        expect(err.exitCode).to.equal(68);
      }
    });

    it('records partial results when validatePreviewSession fails for one session', async () => {
      getCachedSessionIdsStub.resolves(['session-1', 'session-2']);
      validatePreviewSessionStub.onFirstCall().resolves().onSecondCall().rejects(new Error('stale session'));

      try {
        await AgentPreviewEnd.run([
          '--all',
          '--authoring-bundle',
          'My_Local_Agent',
          '--target-org',
          'test@org.com',
          '--no-prompt',
        ]);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        const err = error as any;
        expect(err.message).to.include('session-2');
        expect(err.message).to.include('stale session');
        expect(err.message).to.include('Successfully ended 1 session(s)');
        // 1 remove: session-1 (success); session-2 validate fails so no cache removal
        expect(removeCacheStub.callCount).to.equal(1);
        expect(agentPreviewEndStub.callCount).to.equal(1);
        expect(err.name).to.equal('PreviewEndPartialFailure');
      }
    });
  });

  describe('--all flag: confirmation prompt', () => {
    it('prompts for confirmation before ending sessions', async () => {
      getCachedSessionIdsStub.resolves([SESSION_ID]);
      confirmStub.resolves(true);

      await AgentPreviewEnd.run(['--all', '--authoring-bundle', 'My_Local_Agent', '--target-org', 'test@org.com']);

      expect(confirmStub.calledOnce).to.be.true;
      expect(removeCacheStub.calledOnce).to.be.true;
    });

    it('uses the --authoring-bundle flag value (not the internal storage ID) in the confirmation prompt', async () => {
      getCachedSessionIdsStub.resolves([SESSION_ID]);
      confirmStub.resolves(true);

      await AgentPreviewEnd.run(['--all', '--authoring-bundle', 'My_Local_Agent', '--target-org', 'test@org.com']);

      expect(confirmStub.calledOnce).to.be.true;
      const promptMessage: string = confirmStub.firstCall.args[0].message as string;
      expect(promptMessage).to.include('My_Local_Agent');
      expect(promptMessage).not.to.include(AGENT_ID);
    });

    it('uses the --api-name flag value (not the internal storage ID) in the confirmation prompt', async () => {
      getCachedSessionIdsStub.resolves([SESSION_ID]);
      confirmStub.resolves(true);

      await AgentPreviewEnd.run(['--all', '--api-name', 'My_Published_Agent', '--target-org', 'test@org.com']);

      expect(confirmStub.calledOnce).to.be.true;
      const promptMessage: string = confirmStub.firstCall.args[0].message as string;
      expect(promptMessage).to.include('My_Published_Agent');
      expect(promptMessage).not.to.include(AGENT_ID);
    });

    it('returns an empty ended list when user declines the confirmation prompt', async () => {
      getCachedSessionIdsStub.resolves([SESSION_ID]);
      confirmStub.resolves(false);

      const result = await AgentPreviewEnd.run([
        '--all',
        '--authoring-bundle',
        'My_Local_Agent',
        '--target-org',
        'test@org.com',
      ]);

      expect(removeCacheStub.called).to.be.false;
      expect(result).to.deep.equal({ ended: [] });
    });

    it('skips the confirmation prompt when --no-prompt is provided', async () => {
      getCachedSessionIdsStub.resolves([SESSION_ID]);

      await AgentPreviewEnd.run([
        '--all',
        '--authoring-bundle',
        'My_Local_Agent',
        '--target-org',
        'test@org.com',
        '--no-prompt',
      ]);

      expect(confirmStub.called).to.be.false;
      expect(removeCacheStub.calledOnce).to.be.true;
    });
  });

  describe('--all flag: all-agents path (no agent identifier)', () => {
    it('ends sessions for all agents from listCachedSessions when only --target-org is provided', async () => {
      listCachedSessionsStub.resolves([
        {
          agentId: 'My_Script_Agent',
          sessions: [
            { sessionId: 'sess-1', sessionType: 'simulated' },
            { sessionId: 'sess-2', sessionType: 'live' },
          ],
        },
        {
          agentId: '0Xxg8000000NBNlCAO',
          sessions: [{ sessionId: 'sess-3', sessionType: 'published' }],
        },
      ]);

      const result = await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com', '--no-prompt']);

      expect(listCachedSessionsStub.calledOnce).to.be.true;
      expect(initStub.callCount).to.equal(2);
      expect(validatePreviewSessionStub.callCount).to.equal(3);
      expect(removeCacheStub.callCount).to.equal(3);
      expect((result as { ended: unknown[] }).ended).to.have.length(3);
    });

    it('returns empty ended list when listCachedSessions returns no sessions', async () => {
      listCachedSessionsStub.resolves([]);

      const result = await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com', '--no-prompt']);

      expect(result).to.deep.equal({ ended: [] });
      expect(initStub.called).to.be.false;
    });

    it('throws when --all alone is used without --target-org', async () => {
      try {
        await AgentPreviewEnd.run(['--all']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        expect((error as Error).message).to.include('--target-org');
      }
    });

    it('uses aabName (ScriptAgent) for live sessionType', async () => {
      listCachedSessionsStub.resolves([
        {
          agentId: 'Local_Info_Agent',
          sessions: [{ sessionId: 'aab-sess-1', sessionType: 'live' }],
        },
      ]);

      const result = await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com', '--no-prompt']);

      expect((result as { ended: unknown[] }).ended).to.have.length(1);
      expect(initStub.calledOnce).to.be.true;
      expect(initStub.firstCall.args[0]).to.have.property('aabName', 'Local_Info_Agent');
      expect(removeCacheStub.calledOnce).to.be.true;
    });

    it('uses aabName for simulated/live sessions and apiNameOrId for published', async () => {
      listCachedSessionsStub.resolves([
        {
          agentId: 'My_Script_Agent',
          sessions: [{ sessionId: 'sess-sim', sessionType: 'simulated' }],
        },
        {
          agentId: 'Weather_Agent',
          sessions: [{ sessionId: 'sess-pub', sessionType: 'published' }],
        },
      ]);

      await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com', '--no-prompt']);

      expect(initStub.callCount).to.equal(2);
      expect(initStub.firstCall.args[0]).to.have.property('aabName', 'My_Script_Agent');
      expect(initStub.secondCall.args[0]).to.have.property('apiNameOrId', 'Weather_Agent');
    });

    it('throws PreviewEndPartialFailure when one agent succeeds and another throws (no agent identifier)', async () => {
      // Two agents, one session each. The second agent's callPreviewEnd call throws.
      // agent.preview.end is agentPreviewEndStub (shared across mock instances via MockScriptAgent).
      agentPreviewEndStub.onFirstCall().resolves().onSecondCall().rejects(new Error('agent B exploded'));

      listCachedSessionsStub.resolves([
        {
          agentId: 'Agent_A',
          sessions: [{ sessionId: 'sess-a-1', sessionType: 'simulated' }],
        },
        {
          agentId: 'Agent_B',
          sessions: [{ sessionId: 'sess-b-1', sessionType: 'simulated' }],
        },
      ]);

      try {
        await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com', '--no-prompt']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        const err = error as any;
        expect(err.name).to.equal('PreviewEndPartialFailure');
        expect(err.message).to.include('Failed to end 1 session(s)');
        expect(err.message).to.include('sess-b-1');
        expect(err.message).to.include('agent B exploded');
        expect(err.message).to.include('Successfully ended 1 session(s)');
        expect(err.message).to.include('sess-a-1');
      }
    });

    it('prompts for confirmation and ends sessions when user confirms (all-agents path)', async () => {
      listCachedSessionsStub.resolves([
        {
          agentId: 'Confirmed_Agent',
          sessions: [{ sessionId: 'conf-sess-1', sessionType: 'simulated' }],
        },
      ]);
      confirmStub.resolves(true);

      const result = await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com']);

      expect(confirmStub.calledOnce).to.be.true;
      expect(removeCacheStub.calledOnce).to.be.true;
      expect(listCachedSessionsStub.calledOnce).to.be.true;
      expect((result as { ended: unknown[] }).ended).to.have.length(1);
    });

    it('returns empty ended list when user declines the confirmation prompt (all-agents path)', async () => {
      listCachedSessionsStub.resolves([
        {
          agentId: 'Declined_Agent',
          sessions: [{ sessionId: 'dec-sess-1', sessionType: 'simulated' }],
        },
      ]);
      confirmStub.resolves(false);

      const result = await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com']);

      expect(confirmStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({ ended: [] });
      expect(removeCacheStub.called).to.be.false;
    });

    it('records failed sessions for the entry where Agent.init throws and succeeds for the other (all-agents path)', async () => {
      listCachedSessionsStub.resolves([
        {
          agentId: 'Good_Agent',
          sessions: [{ sessionId: 'good-sess-1', sessionType: 'simulated' }],
        },
        {
          agentId: 'Bad_Agent',
          sessions: [{ sessionId: 'bad-sess-1', sessionType: 'simulated' }],
        },
      ]);
      // Reset the beforeEach default behaviour so per-call setup below takes effect.
      initStub.reset();
      const MockScriptAgent = class {
        public preview = { end: agentPreviewEndStub };
        public setSessionId = sinon.stub();
        public getHistoryDir = sinon.stub().resolves(TRACES_PATH);
        public getAgentIdForStorage = sinon.stub().returns(AGENT_ID);
      };
      const mockInstance = new MockScriptAgent();
      initStub.onFirstCall().resolves(mockInstance).onSecondCall().rejects(new Error('init failed'));

      try {
        await AgentPreviewEnd.run(['--all', '--target-org', 'test@org.com', '--no-prompt']);
        expect.fail('Expected an error to be thrown');
      } catch (error: unknown) {
        const err = error as any;
        expect(err.name).to.equal('PreviewEndPartialFailure');
        expect(err.message).to.include('Failed to end 1 session(s)');
        expect(err.message).to.include('bad-sess-1');
        expect(err.message).to.include('init failed');
        expect(err.message).to.include('Successfully ended 1 session(s)');
        expect(err.message).to.include('good-sess-1');
      }
    });
  });
});
