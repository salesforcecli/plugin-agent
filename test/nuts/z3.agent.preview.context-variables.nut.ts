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
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { Agent } from '@salesforce/agents';
import { Org, SfProject } from '@salesforce/core';
import type { AgentPreviewStartResult } from '../../src/commands/agent/preview/start.js';
import type { AgentPreviewSendResult } from '../../src/commands/agent/preview/send.js';
import { getTestSession, getUsername } from './shared-setup.js';

/**
 * E2E coverage for typed preview context variables (--context-variables-json), W-24014400.
 *
 * Goal: prove the typed flag is wired up end-to-end against a real org — each wire type
 * (Text/Boolean/Number/Json/List) serializes, reaches the server, and the injected value
 * lands in the session — plus the flag-merge, comma-safety, and rejection paths. This
 * deliberately does NOT assert boolean-gated routing behavior (planner-dependent and
 * flaky); the manual e2e-context-variables-preview.sh suite covers that.
 *
 * How values are observed: injected context variables surface in the session trace (the
 * same mechanism the --context-variables test relies on). Each case injects a distinctive
 * sentinel value and asserts it appears in the trace after a send.
 *
 * Fixture: Willie_Resort_Manager declares test-only External vars NutProbeText (Text),
 * NutProbeBool (Boolean), NutProbeNum (Number), NutProbeObj (Json object), NutProbeList
 * (List), plus the pre-existing Internal var VerifiedCustomerId (no visibility) used by the
 * server-rejection case.
 */
describe('agent preview --context-variables-json', function () {
  this.timeout(30 * 60 * 1000); // 30 minutes (shared setup deploys + waits on Einstein)

  const bundle = 'Willie_Resort_Manager';
  let session: TestSession;

  before(async function () {
    this.timeout(30 * 60 * 1000);
    session = await getTestSession();
  });

  // Start a simulate-mode session with the given raw flag string; returns the session id.
  function startSession(flagArgs: string): string {
    const org = getUsername();
    const res = execCmd<AgentPreviewStartResult>(
      `agent preview start --authoring-bundle ${bundle} --simulate-actions ${flagArgs} --target-org ${org} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    ).jsonOutput?.result;
    expect(res?.sessionId, 'session should start').to.be.a('string');
    return res!.sessionId;
  }

  // Send one message, then return every trace serialized to a single searchable string.
  async function sendAndCollectTraces(sessionId: string, utterance = 'hello'): Promise<string> {
    const sendRes = execCmd<AgentPreviewSendResult>(
      `agent preview send --session-id ${sessionId} --authoring-bundle ${bundle} --utterance "${utterance}" --target-org ${getUsername()} --json`,
      { ensureExitCode: 0, cwd: session.project.dir }
    ).jsonOutput?.result;
    expect(sendRes?.messages).to.be.an('array').with.length.greaterThan(0);

    const org = await Org.create({ aliasOrUsername: getUsername() });
    const project = await SfProject.resolve(session.project.dir);
    const agent = await Agent.init({ connection: org.getConnection(), project, aabName: bundle });
    agent.setSessionId(sessionId);
    const traces = await agent.preview.getAllTraces();
    return JSON.stringify(traces);
  }

  function endSession(sessionId: string): void {
    execCmd(
      `agent preview end --session-id ${sessionId} --authoring-bundle ${bundle} --target-org ${getUsername()} --json`,
      { cwd: session.project.dir }
    );
  }

  it('CV1: all wire types (Text/Number/Json/List/Boolean) round-trip in one session', async function () {
    this.timeout(5 * 60 * 1000);
    const TEXT = 'NUTCV-TEXT-7f3a9b';
    const NUM = 8_675_309;
    const JSON_TAG = 'NUTCV-JSON-4d21c8';
    const LIST_ELEM = 'NUTCV-LIST-b58c1e';
    const payload = JSON.stringify([
      { name: 'NutProbeText', type: 'Text', value: TEXT },
      { name: 'NutProbeNum', type: 'Number', value: NUM },
      { name: 'NutProbeBool', type: 'Boolean', value: true },
      { name: 'NutProbeObj', type: 'Json', value: { tag: JSON_TAG } },
      { name: 'NutProbeList', type: 'List', value: [LIST_ELEM] },
    ]);

    const sessionId = startSession(`--context-variables-json '${payload}'`);
    const haystack = await sendAndCollectTraces(sessionId);

    expect(haystack, 'Text value should reach the session').to.include(TEXT);
    expect(haystack, 'Number value should reach the session').to.include(String(NUM));
    expect(haystack, 'Json object value should reach the session').to.include(JSON_TAG);
    expect(haystack, 'List element should reach the session').to.include(LIST_ELEM);
    expect(haystack, 'Boolean variable should be present in the session').to.include('NutProbeBool');

    endSession(sessionId);
  });

  it('CV2: --context-variables-json wins over --context-variables on a duplicate name', async function () {
    this.timeout(5 * 60 * 1000);
    const OLD = 'NUTCV-OLD-LOSES';
    const NEW = 'NUTCV-NEW-WINS';
    const sessionId = startSession(
      `--context-variables "NutProbeText=${OLD}" --context-variables-json '[{"name":"NutProbeText","type":"Text","value":"${NEW}"}]'`
    );
    const haystack = await sendAndCollectTraces(sessionId);

    expect(haystack, 'JSON value should win').to.include(NEW);
    expect(haystack, 'text value should have been overridden').to.not.include(OLD);

    endSession(sessionId);
  });

  it('CV3: a comma inside a value survives the JSON flag', async function () {
    this.timeout(5 * 60 * 1000);
    const COMMA_VALUE = 'c0,c1,c2';
    const sessionId = startSession(
      `--context-variables-json '[{"name":"NutProbeText","type":"Text","value":"${COMMA_VALUE}"}]'`
    );
    const haystack = await sendAndCollectTraces(sessionId);

    expect(haystack, 'comma-bearing value should round-trip intact').to.include(COMMA_VALUE);

    endSession(sessionId);
  });

  it('CV4: the old --context-variables flag mangles a comma value (control)', () => {
    // The old flag splits on "," so "a,b,c" becomes 3 tokens; the 2nd has no "=".
    const result = execCmd(
      `agent preview start --authoring-bundle ${bundle} --simulate-actions --context-variables "NutProbeText=a,b,c" --target-org ${getUsername()} --json`,
      { ensureExitCode: 1, cwd: session.project.dir }
    );
    expect(JSON.stringify(result.shellOutput)).to.include('Expected Name=Value');
  });

  it('CV5: the server rejects an Internal variable', () => {
    // VerifiedCustomerId has no visibility -> Internal -> not settable via preview.
    const result = execCmd(
      `agent preview start --authoring-bundle ${bundle} --simulate-actions --context-variables-json '[{"name":"VerifiedCustomerId","type":"Text","value":"x"}]' --target-org ${getUsername()} --json`,
      { cwd: session.project.dir }
    );
    expect(result.shellOutput.code, 'command should fail').to.not.equal(0);
    expect(JSON.stringify(result.shellOutput)).to.include('Internal');
  });

  it('CV6: a value whose JSON type mismatches its declared type is rejected client-side', () => {
    const result = execCmd(
      `agent preview start --authoring-bundle ${bundle} --simulate-actions --context-variables-json '[{"name":"NutProbeBool","type":"Boolean","value":"true"}]' --target-org ${getUsername()} --json`,
      { ensureExitCode: 1, cwd: session.project.dir }
    );
    expect(JSON.stringify(result.shellOutput)).to.include('expects a boolean value');
  });
});
