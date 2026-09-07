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
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';

const SPEC = {
  apiName: 'Sentiment_Scorer',
  lightningType: 'lightning__textType',
  label: 'Sentiment Scorer',
  engineType: 'PromptTemplate',
  agentAssociation: { agentApiName: 'My_Agent', isActive: true },
};

const SESSION = {
  sessionState: { sessionId: 'S1', startTimestamp: '2026-01-01T00:00:00Z', channel: 'web' },
  actors: [],
  metrics: { durationMs: 0, turns: 0 },
  runs: [],
};

const SESSION_FILE = 'session.json';

async function loadMockedCommand(opts?: {
  runScorerResult?: any;
  runScorerError?: Error;
  loadScorerSpecError?: Error;
}): Promise<{ Command: any; runScorer: sinon.SinonStub; loadScorerSpec: sinon.SinonStub }> {
  const runScorer = sinon.stub();
  if (opts?.runScorerError) runScorer.rejects(opts.runScorerError);
  else runScorer.resolves(opts?.runScorerResult ?? { ok: true, output: 'Positive', explanation: 'Looks good.' });

  const loadScorerSpec = sinon.stub();
  if (opts?.loadScorerSpecError) loadScorerSpec.rejects(opts.loadScorerSpecError);
  else loadScorerSpec.resolves(SPEC);

  const readFileSync = (path: unknown): string => {
    const p = String(path);
    if (p.endsWith('.json')) return JSON.stringify(SESSION);
    return '';
  };

  const mocks: Record<string, any> = {
    'node:fs': { readFileSync },
    '@salesforce/agents': {
      runScorer,
      loadScorerSpec,
      sessionViewJsonSchema: () => ({ $schema: 'http://json-schema.org/draft-07/schema#' }),
    },
  };

  const mod = await esmock('../../../../src/commands/agent/scorer/run.js', mocks);
  return { Command: mod.default, runScorer, loadScorerSpec };
}

describe('agent scorer run', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let originalCwd: string;
  let workDir: string;

  before(async function () {
    try {
      await esmock('../../../../src/commands/agent/scorer/run.js', {
        'node:fs': { readFileSync: () => '' },
        '@salesforce/agents': {
          runScorer: () => Promise.resolve({ ok: true }),
          loadScorerSpec: () => Promise.resolve(SPEC),
          sessionViewJsonSchema: () => ({}),
        },
      });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('esmock warmup failed:', e.message);
      this.skip();
    }

    originalCwd = process.cwd();
    workDir = mkdtempSync(join(tmpdir(), 'scorer-run-'));
    // Flags.file({ exists: true }) stats this at parse time, so it must exist on disk.
    writeFileSync(join(workDir, SESSION_FILE), '');
    process.chdir(workDir);
  });

  after(() => {
    if (originalCwd) process.chdir(originalCwd);
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);

    // requiresProject: stub the project so package directories resolve without a real sfdx-project.json.
    $$.inProject(true);
    const mockProject = {
      getPath: () => workDir,
      getUniquePackageDirectories: () => [{ fullPath: join(workDir, 'force-app') }],
    } as unknown as SfProject;
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
    sinon.restore();
  });

  it('resolves the scorer by API name and runs it against a session file', async () => {
    const { Command, runScorer, loadScorerSpec } = await loadMockedCommand();

    const result = await Command.run([
      '--target-org', testOrg.username,
      '--api-name', 'Sentiment_Scorer',
      '--file', SESSION_FILE,
      '--json',
    ]);

    expect(result.scorerApiName).to.equal('Sentiment_Scorer');
    expect(result.ok).to.equal(true);
    expect(result.output).to.equal('Positive');
    expect(result.explanation).to.equal('Looks good.');

    expect(loadScorerSpec.calledOnce).to.be.true;
    expect(loadScorerSpec.firstCall.firstArg.apiName).to.equal('Sentiment_Scorer');
    expect(loadScorerSpec.firstCall.firstArg.directories).to.be.an('array').that.is.not.empty;

    expect(runScorer.calledOnce).to.be.true;
    const [passedSpec, passedSession] = runScorer.firstCall.args;
    expect(passedSpec.apiName).to.equal('Sentiment_Scorer');
    expect(passedSession.sessionState.sessionId).to.equal('S1');
  });

  it('runs a scorer against inline session JSON', async () => {
    const { Command, runScorer } = await loadMockedCommand();

    const result = await Command.run([
      '--target-org', testOrg.username,
      '--api-name', 'Sentiment_Scorer',
      '--data', JSON.stringify(SESSION),
      '--json',
    ]);

    expect(result.scorerApiName).to.equal('Sentiment_Scorer');
    expect(result.ok).to.equal(true);
    const [, passedSession] = runScorer.firstCall.args;
    expect(passedSession.sessionState.sessionId).to.equal('S1');
  });

  it('passes the connection from the target org to runScorer', async () => {
    const { Command, runScorer } = await loadMockedCommand();

    await Command.run([
      '--target-org', testOrg.username,
      '--api-name', 'Sentiment_Scorer',
      '--file', SESSION_FILE,
      '--json',
    ]);

    const [, , connection] = runScorer.firstCall.args;
    expect(connection).to.not.be.undefined;
  });

  it('surfaces an engine error result', async () => {
    const { Command } = await loadMockedCommand({
      runScorerResult: { ok: false, error: 'no engine for Manual' },
    });

    const result = await Command.run([
      '--target-org', testOrg.username,
      '--api-name', 'Sentiment_Scorer',
      '--file', SESSION_FILE,
      '--json',
    ]);

    expect(result.ok).to.equal(false);
    expect(result.error).to.equal('no engine for Manual');
  });

  it('surfaces the error when the scorer is not found in the project', async () => {
    const { Command } = await loadMockedCommand({
      loadScorerSpecError: new Error("No scorer named 'Missing_Scorer' was found in this project."),
    });

    try {
      await Command.run([
        '--target-org', testOrg.username,
        '--api-name', 'Missing_Scorer',
        '--file', SESSION_FILE,
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message).to.include('was found in this project');
    }
  });

  it('throws when neither --data nor --file is provided', async () => {
    const { Command } = await loadMockedCommand();

    try {
      await Command.run([
        '--target-org', testOrg.username,
        '--api-name', 'Sentiment_Scorer',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message.toLowerCase()).to.match(/data|file/);
    }
  });

  it('throws when both --data and --file are provided', async () => {
    const { Command } = await loadMockedCommand();

    try {
      await Command.run([
        '--target-org', testOrg.username,
        '--api-name', 'Sentiment_Scorer',
        '--data', JSON.stringify(SESSION),
        '--file', SESSION_FILE,
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message.toLowerCase()).to.match(/data|file/);
    }
  });

  it('throws a clear error when the session is not valid JSON', async () => {
    const { Command } = await loadMockedCommand();

    try {
      await Command.run([
        '--target-org', testOrg.username,
        '--api-name', 'Sentiment_Scorer',
        '--data', '{not valid json',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message).to.include('Could not parse the STDM session as JSON');
    }
  });

  it('throws a clear error when the session JSON is not an object', async () => {
    const { Command } = await loadMockedCommand();

    try {
      await Command.run([
        '--target-org', testOrg.username,
        '--api-name', 'Sentiment_Scorer',
        '--data', '["not", "an", "object"]',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message).to.include('must be a JSON object');
    }
  });
});
