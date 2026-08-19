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

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'chai';
import { execCmd, Duration, TestSession } from '@salesforce/cli-plugins-testkit';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { Agent } from '@salesforce/agents';
import { Org } from '@salesforce/core';
import { AgentTestCache } from '../../src/agentTestCache.js';
import type { AgentTestListResult } from '../../src/commands/agent/test/list.js';
import type { AgentTestResultsResult } from '../../src/commands/agent/test/results.js';
import type { AgentTestRunResult } from '../../src/flags.js';
import { getTestSession, getUsername } from './shared-setup.js';

/* eslint-disable no-console */

// Agentforce Studio (AiTestingDefinition) NUTs.
// Depends on z2 having published a Test_Agent_* agent. The before() hook discovers that
// agent, writes an AiTestingDefinition with the correct subjectName, and deploys it.
describe('agent test (agentforce-studio)', function () {
  this.timeout(30 * 60 * 1000);

  let session: TestSession;
  let afsTestName: string;

  before(async function () {
    this.timeout(30 * 60 * 1000);
    session = await getTestSession();

    const org = await Org.create({ aliasOrUsername: getUsername() });
    const connection = org.getConnection();

    // Find the agent published in z2
    const publishedAgent = (await Agent.listRemote(connection)).find((a) => a.DeveloperName?.startsWith('Test_Agent_'));
    if (!publishedAgent?.DeveloperName) {
      throw new Error('No published Test_Agent_* found — ensure z2.agent.publish.nut runs first');
    }

    const agentName = publishedAgent.DeveloperName;
    afsTestName = `${agentName}_AFS_Test`;
    console.log(`Using agent '${agentName}', test definition '${afsTestName}'`);

    // Write AiTestingDefinition metadata file
    const metaDir = join(session.project.dir, 'force-app', 'main', 'default', 'aiTestingDefinitions');
    mkdirSync(metaDir, { recursive: true });

    const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<AiTestingDefinition xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>AFS NUT test for ${agentName}</description>
    <name>${afsTestName}</name>
    <subjectName>${agentName}</subjectName>
    <subjectType>AGENT</subjectType>
    <subjectVersion>v1</subjectVersion>
    <testCase>
        <inputs>
            <utterance>Hi, can you tell me what your return or refund policy is? Please include citations in the answer, and use this citations URL: https://help.example.com/citations.</utterance>
        </inputs>
        <number>1</number>
        <scorer>
            <expectedValue>GeneralFAQ</expectedValue>
            <name>topic_sequence_match</name>
        </scorer>
        <scorer>
            <expectedValue>[&apos;AnswerQuestionsWithKnowledge&apos;]</expectedValue>
            <name>action_sequence_match</name>
        </scorer>
        <scorer>
            <expectedValue>I can help with that. Here&apos;s what I found in our knowledge base about the return/refund policy.</expectedValue>
            <name>bot_response_rating</name>
        </scorer>
        <scorer>
            <name>conciseness</name>
        </scorer>
        <scorer>
            <name>coherence</name>
        </scorer>
        <scorer>
            <name>output_latency_milliseconds</name>
        </scorer>
        <scorer>
            <name>completeness</name>
        </scorer>
    </testCase>
    <testCase>
        <inputs>
            <utterance>Hey, I need help with something important—can you take care of it for me?</utterance>
        </inputs>
        <number>2</number>
        <scorer>
            <expectedValue>ambiguous_question</expectedValue>
            <name>topic_sequence_match</name>
        </scorer>
        <scorer>
            <name>conciseness</name>
        </scorer>
        <scorer>
            <name>coherence</name>
        </scorer>
        <scorer>
            <name>output_latency_milliseconds</name>
        </scorer>
        <scorer>
            <name>completeness</name>
        </scorer>
    </testCase>
</AiTestingDefinition>
`;
    writeFileSync(join(metaDir, `${afsTestName}.aiTestingDefinition-meta.xml`), metaXml, 'utf8');
    console.log(`Wrote AiTestingDefinition metadata to ${metaDir}`);

    // Deploy the definition. Scope to just the file we authored — deploying the whole
    // aiTestingDefinitions dir would also sweep in static fixtures (e.g. ReturnsCheckoutSuite,
    // which targets a non-deployed multi-agent subject) and fail server-side validation.
    const cs = await ComponentSetBuilder.build({
      sourcepath: [join(metaDir, `${afsTestName}.aiTestingDefinition-meta.xml`)],
    });
    const deploy = await cs.deploy({ usernameOrConnection: getUsername() });
    const deployResult = await deploy.pollStatus({ frequency: Duration.seconds(10), timeout: Duration.minutes(10) });
    if (!deployResult.response.success) {
      const failures = deployResult.response.details?.componentFailures;
      const msgs = (Array.isArray(failures) ? failures : failures ? [failures] : [])
        .map((f) => `${f.problemType}: ${f.problem}`)
        .join('\n');
      throw new Error(`Deploy of AiTestingDefinition failed:\n${msgs}`);
    }
    console.log(`Deployed AiTestingDefinition '${afsTestName}'`);
  });

  // Set by the run test, consumed by the results/resume tests (Mocha runs describes sequentially).
  // The AFS eval can outlast the client --wait window, so the run may still be IN_PROGRESS here.
  let sharedRunId: string;
  let primaryRunCompleted = false;

  describe('agent test list', () => {
    it('should include the AFS test definition in list', async () => {
      const result = execCmd<AgentTestListResult>(`agent test list --target-org ${getUsername()} --json`, {
        ensureExitCode: 0,
      }).jsonOutput?.result;
      expect(result).to.be.ok;
      const afsDefs = result?.filter((r) => r.type?.includes('AiTestingDefinition'));
      expect(afsDefs?.length).to.be.greaterThanOrEqual(1);
      expect(afsDefs?.some((r) => r.fullName === afsTestName)).to.be.true;
    });
  });

  describe('agent test run', () => {
    it('should run with --wait, auto-detect agentforce-studio, and return AFS result shape', function () {
      this.timeout(30 * 60 * 1000);
      const output = execCmd<AgentTestRunResult>(
        `agent test run --api-name ${afsTestName} --target-org ${getUsername()} --wait 10 --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;

      const result = output?.result as AgentTestRunResult & { testCases?: unknown[] };
      // The AFS eval can take longer than the --wait window. A client-side timeout is a valid
      // outcome that now reports IN_PROGRESS (rather than masking as COMPLETED), so accept either
      // and assert only the run shape. testCases is only guaranteed once the run has COMPLETED.
      expect(result?.status).to.be.oneOf(['COMPLETED', 'IN_PROGRESS']);
      expect(result?.runId.startsWith('3A2')).to.be.true;
      expect(result).to.not.have.property('subjectName');
      if (result?.status === 'COMPLETED') {
        expect(result?.testCases).to.be.an('array');
        primaryRunCompleted = true;
      }

      sharedRunId = output!.result.runId;
    });
  });

  describe('agent test results', () => {
    it('should fetch AFS results by job ID (json)', async () => {
      const output = execCmd<AgentTestResultsResult>(
        `agent test results --job-id ${sharedRunId} --target-org ${getUsername()} --json`,
        { ensureExitCode: 0 }
      ).jsonOutput;

      const result = output?.result as { status: string; testCases?: unknown[] };
      expect(result?.status).to.be.a('string');
      expect(result?.testCases).to.be.an('array');
      expect(output?.result).to.not.have.property('subjectName');
    });

    it('should support human result format', () => {
      const output = execCmd(
        `agent test results --job-id ${sharedRunId} --result-format human --target-org ${getUsername()}`,
        { ensureExitCode: 0 }
      );
      expect(output.shellOutput.stdout).to.be.a('string').with.length.greaterThan(0);
    });

    it('should support junit result format', () => {
      const output = execCmd(
        `agent test results --job-id ${sharedRunId} --result-format junit --target-org ${getUsername()}`,
        { ensureExitCode: 0 }
      );
      expect(output.shellOutput.stdout).to.include('<?xml');
      expect(output.shellOutput.stdout).to.include('testsuite');
    });

    it('should support tap result format', () => {
      const output = execCmd(
        `agent test results --job-id ${sharedRunId} --result-format tap --target-org ${getUsername()}`,
        { ensureExitCode: 0 }
      );
      expect(output.shellOutput.stdout).to.include('TAP version 13');
    });
  });

  describe('agent test resume', () => {
    it('should resume the in-flight run (or a fresh async run) and honor the cache', async function () {
      this.timeout(30 * 60 * 1000);

      if (primaryRunCompleted) {
        // The primary --wait run already finished, so its cache entry was removed and no run is
        // in flight. Start a fresh async run to exercise NEW + cache-write, then resume by job-id.
        const cacheBefore = await AgentTestCache.create();
        cacheBefore.clear();
        await cacheBefore.write();

        const runResult = execCmd<AgentTestRunResult>(
          `agent test run --api-name ${afsTestName} --target-org ${getUsername()} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;

        expect(runResult?.result.runId.startsWith('3A2')).to.be.true;
        expect(runResult?.result.status).to.equal('NEW');

        // Re-read from disk — the run command wrote the cache entry in a subprocess
        const cache = await AgentTestCache.create();
        expect(cache.resolveFromCache().runnerType).to.equal('agentforce-studio');

        const output = execCmd<AgentTestRunResult>(
          `agent test resume --job-id ${runResult?.result.runId} --target-org ${getUsername()} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;

        // Resume may itself time out (the eval can outlast the poll window); both are valid.
        expect(output?.result.status).to.be.oneOf(['COMPLETED', 'IN_PROGRESS']);
        expect(output?.result.runId.startsWith('3A2')).to.be.true;
      } else {
        // The primary --wait run timed out client-side and is still running server-side. Our fix
        // preserves the cache entry on a timeout, so resume --use-most-recent picks it up. Starting
        // a NEW run here would collide — AFS allows only one run per definition at a time.
        const cache = await AgentTestCache.create();
        expect(cache.resolveFromCache().runnerType).to.equal('agentforce-studio');

        const output = execCmd<AgentTestRunResult>(
          `agent test resume --use-most-recent --target-org ${getUsername()} --json`,
          { ensureExitCode: 0 }
        ).jsonOutput;

        expect(output?.result.status).to.be.oneOf(['COMPLETED', 'IN_PROGRESS']);
        expect(output?.result.runId).to.equal(sharedRunId);
      }
    });
  });

  describe('error handling', () => {
    it('should return exit code 2 for a non-existent AFS test definition', () => {
      execCmd(
        `agent test run --api-name NonExistent_AFS_Test_XYZ --test-runner agentforce-studio --target-org ${getUsername()} --json`,
        { ensureExitCode: 2 }
      );
    });
  });
});
