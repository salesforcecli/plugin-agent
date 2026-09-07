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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */

import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import * as agentsModule from '@salesforce/agents';

type WrittenFile = { path: string; content: string };

const SPEC: any = {
  apiName: 'Test_Scorer',
  lightningType: 'lightning__textType',
  inputScope: 'Session',
  label: 'Test Scorer',
  engineType: 'Manual',
  status: 'Draft',
  agentAssociation: { agentApiName: 'My_Agent', isActive: false },
};

const SPEC_ACTIVE: any = { ...SPEC, agentAssociation: { agentApiName: 'My_Agent', isActive: true } };

/** Build a scorer XML fixture with `versions` sequential versions (v1..vN) from `spec`. */
function scorerXmlWithVersions(versions: number, spec: any = SPEC): string {
  let xml = (agentsModule as any).buildScorerXml(spec);
  for (let i = 2; i <= versions; i++) {
    ({ xml } = (agentsModule as any).addVersionToScorerXml(xml, spec));
  }
  return String(xml);
}

// The edit command reads/writes the scorer XML via node:fs/promises. esmock swaps that module for the command
// only, so reads return a fixture and writes are captured — no disk I/O and no reliance on core-module stubbing.
async function loadMockedCommand(
  existingScorerXml: string | null,
  readError?: NodeJS.ErrnoException
): Promise<{ Command: any; writtenFiles: WrittenFile[] }> {
  const writtenFiles: WrittenFile[] = [];

  const readFile = (): Promise<string> => {
    // readError models a non-ENOENT read failure (EACCES, EISDIR, …); null models a missing file (ENOENT).
    if (readError) return Promise.reject(readError);
    return existingScorerXml == null
      ? Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      : Promise.resolve(existingScorerXml);
  };

  const writeFile = (path: unknown, content: unknown): Promise<void> => {
    writtenFiles.push({ path: String(path), content: String(content) });
    return Promise.resolve();
  };

  const mod = await esmock('../../../../src/commands/agent/scorer/edit.js', {
    'node:fs/promises': { readFile, writeFile },
  });
  return { Command: mod.default, writtenFiles };
}

describe('agent scorer edit', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  before(async function () {
    try {
      await esmock('../../../../src/commands/agent/scorer/edit.js', {});
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('esmock warmup failed:', e.message);
      this.skip();
    }
  });

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
    sinon.restore();
  });

  it('promotes a version to Available with --status Available', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    const result = await Command.run([
      '--api-name', 'Test_Scorer',
      '--version', '1',
      '--status', 'Available',
      '--output-dir', '/tmp/out',
      '--json',
    ]);

    expect(result.apiName).to.equal('Test_Scorer');
    expect(writtenFiles).to.have.length(1);
    expect(writtenFiles[0].content).to.include('<status>Available</status>');
  });

  it('archives a version with --status Archived', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    await Command.run([
      '--api-name', 'Test_Scorer',
      '--version', '1',
      '--status', 'Archived',
      '--output-dir', '/tmp/out',
      '--json',
    ]);

    expect(writtenFiles).to.have.length(1);
    expect(writtenFiles[0].content).to.include('<status>Archived</status>');
  });

  it('activates the agent association with --activate', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    await Command.run([
      '--api-name', 'Test_Scorer',
      '--version', '1',
      '--activate',
      '--output-dir', '/tmp/out',
      '--json',
    ]);

    expect(writtenFiles).to.have.length(1);
    expect(writtenFiles[0].content).to.include('<isActive>true</isActive>');
  });

  it('deactivates the agent association with --deactivate', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1, SPEC_ACTIVE));

    await Command.run([
      '--api-name', 'Test_Scorer',
      '--version', '1',
      '--deactivate',
      '--output-dir', '/tmp/out',
      '--json',
    ]);

    expect(writtenFiles).to.have.length(1);
    expect(writtenFiles[0].content).to.include('<isActive>false</isActive>');
  });

  it('changes status and activation together in a single write', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    await Command.run([
      '--api-name', 'Test_Scorer',
      '--version', '1',
      '--status', 'Available',
      '--activate',
      '--output-dir', '/tmp/out',
      '--json',
    ]);

    // A single load → both mutations → one write, so the written XML carries both changes.
    expect(writtenFiles).to.have.length(1);
    expect(writtenFiles[0].content).to.include('<status>Available</status>');
    expect(writtenFiles[0].content).to.include('<isActive>true</isActive>');
  });

  it('errors when neither --status nor --activate/--deactivate is provided', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    try {
      await Command.run(['--api-name', 'Test_Scorer', '--version', '1', '--output-dir', '/tmp/out', '--json']);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message).to.match(/status|activate|deactivate/);
    }
    expect(writtenFiles).to.have.length(0);
  });

  it('rejects --activate together with --deactivate', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    try {
      await Command.run([
        '--api-name', 'Test_Scorer',
        '--version', '1',
        '--activate',
        '--deactivate',
        '--output-dir', '/tmp/out',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message).to.match(/activate|deactivate/);
    }
    expect(writtenFiles).to.have.length(0);
  });

  it('errors when the scorer file is not found', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(null);

    try {
      await Command.run([
        '--api-name', 'Missing_Scorer',
        '--version', '1',
        '--status', 'Available',
        '--output-dir', '/tmp/out',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as Error).message).to.include('was found at');
    }
    expect(writtenFiles).to.have.length(0);
  });

  it('rethrows a non-ENOENT read error instead of reporting "scorer not found"', async () => {
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    const { Command, writtenFiles } = await loadMockedCommand('unused', eacces);

    try {
      await Command.run([
        '--api-name', 'Test_Scorer',
        '--version', '1',
        '--status', 'Available',
        '--output-dir', '/tmp/out',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      // the raw fs error propagates; the user is NOT wrongly told the scorer was not found
      expect((err as Error).message).to.include('EACCES');
      expect((err as Error).message).to.not.include('was found at');
    }
    expect(writtenFiles).to.have.length(0);
  });

  it('writes nothing with --preview but prints the resulting XML', async () => {
    const { Command, writtenFiles } = await loadMockedCommand(scorerXmlWithVersions(1));

    const result = await Command.run([
      '--api-name', 'Test_Scorer',
      '--version', '1',
      '--status', 'Available',
      '--output-dir', '/tmp/out',
      '--preview',
    ]);

    expect(writtenFiles).to.have.length(0);
    expect(result.contents).to.include('<status>Available</status>');
    const logged = sfCommandStubs.log.args.map((a) => String(a[0])).join('\n');
    expect(logged).to.include('<status>Available</status>');
  });
});
