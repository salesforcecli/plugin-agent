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

import { writeFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { Agent } from '@salesforce/agents';
import { Org, SfProject } from '@salesforce/core';
import type { AgentPreviewStartResult } from '../../src/commands/agent/preview/start.js';
import type { AgentPreviewSendResult } from '../../src/commands/agent/preview/send.js';
import type { AgentPreviewEndResult } from '../../src/commands/agent/preview/end.js';
import { getTestSession, getUsername } from './shared-setup.js';
/* eslint-disable no-console */

describe('agent preview', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  let session: TestSession;

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    session = await getTestSession();
  });

  describe('--agent-json flag', () => {
    let tmpDir: string;

    before(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'agent-json-nut-'));
    });

    after(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should start a preview session using a pre-compiled AgentJSON file', async function () {
      this.timeout(5 * 60 * 1000);

      const bundleApiName = 'Willie_Resort_Manager';
      const targetOrg = getUsername();

      // Compile the agent once to get a valid agentJson, write it to a temp file,
      // then pass it back via --agent-json. This tests the flag plumbing (the
      // command must accept a pre-compiled file and skip recompilation) while
      // ensuring the fixture matches what the preview sessions API actually accepts.
      const org = await Org.create({ aliasOrUsername: targetOrg });
      const conn = org.getConnection();
      const project = await SfProject.resolve(session.project.dir);
      const agent = await Agent.init({ connection: conn, project, aabName: bundleApiName });
      const compileResult = await agent.compile();
      if (compileResult.status !== 'success' || !compileResult.compiledArtifact) {
        throw new Error(`Compile failed: ${JSON.stringify(compileResult)}`);
      }
      const agentJsonPath = join(tmpDir, 'compiled-agent.json');
      writeFileSync(agentJsonPath, JSON.stringify(compileResult.compiledArtifact));

      const startCmdResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --authoring-bundle ${bundleApiName} --simulate-actions --agent-json "${agentJsonPath}" --target-org ${targetOrg} --json`,
        { ensureExitCode: 0 }
      );
      const startResult = startCmdResult.jsonOutput?.result;

      expect(startResult?.sessionId).to.be.a('string');
      expect(startResult?.agentApiName).to.equal(bundleApiName);

      // Clean up session
      execCmd(
        `agent preview end --session-id ${
          startResult!.sessionId
        } --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`,
        { cwd: session.project.dir }
      );
    });

    it('should fail when --agent-json contains invalid JSON', () => {
      const badJsonPath = join(tmpDir, 'bad.json');
      writeFileSync(badJsonPath, 'not-valid{{{');

      const result = execCmd(
        `agent preview start --authoring-bundle Willie_Resort_Manager --simulate-actions --agent-json ${badJsonPath} --target-org ${getUsername()} --json`,
        { ensureExitCode: 1, cwd: session.project.dir }
      );
      expect(JSON.stringify(result.shellOutput)).to.include('Failed to read or parse');
    });

    it('should fail when --agent-json is used without --authoring-bundle', () => {
      const agentJsonPath = join(tmpDir, 'any.json');
      writeFileSync(agentJsonPath, '{}');

      execCmd(
        `agent preview start --api-name Some_Agent --agent-json ${agentJsonPath} --target-org ${getUsername()} --json`,
        { ensureExitCode: 2 }
      );
    });
  });

  it('should fail when authoring bundle does not exist', async () => {
    const invalidBundle = 'NonExistent_Bundle';
    execCmd(
      `agent preview start --authoring-bundle ${invalidBundle} --simulate-actions --target-org ${getUsername()}`,
      { ensureExitCode: 1 }
    );
  });

  it('should fail when api-name does not exist in org', async () => {
    const invalidApiName = 'NonExistent_Agent_12345';
    execCmd(`agent preview start --api-name ${invalidApiName} --target-org ${getUsername()}`, {
      ensureExitCode: 1,
    });
  });

  describe('using preview start/send/end commands', () => {
    it('should start, send, end a preview (Agent Script, mock mode)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const bundleApiName = 'Willie_Resort_Manager';
      const targetOrg = getUsername();

      const startResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --authoring-bundle ${bundleApiName} --simulate-actions --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(startResult?.sessionId).to.be.a('string');
      expect(startResult?.agentApiName).to.equal(bundleApiName);
      const sessionId = startResult!.sessionId;

      const sendResult1 = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "What can you help me with?" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult1?.messages).to.be.an('array').with.length.greaterThan(0);
      expect(sendResult1?.agentApiName).to.equal(bundleApiName);
      expect(sendResult1?.sessionId).to.equal(sessionId);

      const sendResult2 = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --authoring-bundle ${bundleApiName} --utterance "Tell me more" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult2?.messages).to.be.an('array').with.length.greaterThan(0);
      expect(sendResult2?.agentApiName).to.equal(bundleApiName);
      expect(sendResult2?.sessionId).to.equal(sessionId);

      const endResult = execCmd<AgentPreviewEndResult>(
        `agent preview end --session-id ${sessionId} --authoring-bundle ${bundleApiName} --target-org ${targetOrg} --json`
      ).jsonOutput?.result as import('../../src/commands/agent/preview/end.js').EndedSession | undefined;
      expect(endResult?.sessionId).to.equal(sessionId);
      expect(endResult?.tracesPath).to.be.a('string').and.include('.sfdx').and.include('agents');
    });

    it('should start, send, end a preview (Agent Script, live mode)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test
      const targetOrg = getUsername();
      // live tests require a valid 'default_agent_user' defined in the org, this is done for the publish tests, use that same agent, but from authoring-bundle source
      const org = await Org.create({ aliasOrUsername: targetOrg });
      const connection = org.getConnection();
      const publishedAgents = await Agent.listRemote(connection);
      const publishedAgent = publishedAgents.find((a) => a.DeveloperName?.startsWith('Test_Agent_'));
      expect(publishedAgent).to.not.be.undefined;
      expect(publishedAgent?.DeveloperName).to.be.a('string');

      const startResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --authoring-bundle ${publishedAgent?.DeveloperName} --use-live-actions --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(startResult?.sessionId).to.be.a('string');
      expect(startResult?.agentApiName).to.equal(publishedAgent?.DeveloperName);
      const sessionId = startResult!.sessionId;

      const sendResult1 = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --authoring-bundle ${publishedAgent?.DeveloperName} --utterance "What can you help me with?" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult1?.messages).to.be.an('array').with.length.greaterThan(0);
      expect(sendResult1?.agentApiName).to.equal(publishedAgent?.DeveloperName);
      expect(sendResult1?.sessionId).to.equal(sessionId);

      execCmd<AgentPreviewEndResult>(
        `agent preview end --session-id ${sessionId} --authoring-bundle ${publishedAgent?.DeveloperName} --target-org ${targetOrg} --json`
      );
    });

    it('should start, send, end a preview (Published agent)', async function () {
      this.timeout(5 * 60 * 1000); // 5 minutes for this test

      const org = await Org.create({ aliasOrUsername: getUsername() });
      const connection = org.getConnection();

      const publishedAgents = await Agent.listRemote(connection);
      const publishedAgent = publishedAgents.find((a) => a.DeveloperName?.startsWith('Test_Agent_'));
      expect(publishedAgent).to.not.be.undefined;
      expect(publishedAgent?.DeveloperName).to.be.a('string');

      // Activate published agent before previewing
      execCmd(`agent activate --api-name ${publishedAgent!.DeveloperName} --target-org ${getUsername()} --json`, {
        ensureExitCode: 0,
        cwd: session.project.dir,
      });

      const targetOrg = getUsername();

      const startResult = execCmd<AgentPreviewStartResult>(
        `agent preview start --api-name ${publishedAgent!.DeveloperName} --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(startResult?.sessionId).to.be.a('string');
      expect(startResult?.agentApiName).to.equal(publishedAgent!.DeveloperName);
      const sessionId = startResult!.sessionId;

      const sendResult = execCmd<AgentPreviewSendResult>(
        `agent preview send --session-id ${sessionId} --api-name ${
          publishedAgent!.DeveloperName
        } --utterance "What can you help me with?" --target-org ${targetOrg} --json`
      ).jsonOutput?.result;
      expect(sendResult?.messages).to.be.an('array').with.length.greaterThan(0);
      expect(sendResult?.agentApiName).to.equal(publishedAgent!.DeveloperName);
      expect(sendResult?.sessionId).to.equal(sessionId);

      const endResult = execCmd<AgentPreviewEndResult>(
        `agent preview end --session-id ${sessionId} --api-name ${
          publishedAgent!.DeveloperName
        } --target-org ${targetOrg} --json`
      ).jsonOutput?.result as { sessionId?: string; tracesPath?: string } | undefined;
      expect(endResult?.sessionId).to.equal(sessionId);
      expect(endResult?.tracesPath).to.be.a('string');
    });
  });
});
