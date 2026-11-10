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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';

const LIB = '1JDSG000009q4rx4AA';
const file = (name: string, status: string): Record<string, unknown> => ({
  fileId: `id-${name}`,
  fileName: name,
  filePath: `sf/${name}`,
  fileSize: 1,
  status,
});

describe('agent express-context upload', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let tmp: string;
  let docFile: string;
  let Cmd: any;

  let select: sinon.SinonStub;
  let confirm: sinon.SinonStub;
  let status: sinon.SinonStub;
  let uploadAndWait: sinon.SinonStub;
  let deleteFiles: sinon.SinonStub;

  const run = (...args: string[]): Promise<any> =>
    Cmd.run(['--target-org', testOrg.username, '--library-id', LIB, '--file', docFile, ...args]);
  const rejection = async (p: Promise<unknown>): Promise<Error> => {
    try {
      await p;
    } catch (e) {
      return e as Error;
    }
    throw new Error('expected rejection');
  };
  /** Simulate a flow that uploaded `paths` and then ended with `outcome` (or threw `error`). */
  const flowUploads = (paths: string[], end: { outcome: string } | Error): void => {
    uploadAndWait.callsFake(async (_c, _l, _f, _ui, opts: { onUploaded: (p: string[]) => void }) => {
      opts.onUploaded(paths);
      if (end instanceof Error) throw end;
      return { ...end, files: [] };
    });
  };

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);

    tmp = mkdtempSync(join(tmpdir(), 'aec-upload-'));
    docFile = join(tmp, 'doc.pdf');
    writeFileSync(docFile, 'pdf');

    select = $$.SANDBOX.stub().resolves('abort');
    confirm = $$.SANDBOX.stub().resolves(true);
    status = $$.SANDBOX.stub().resolves({
      libraryId: LIB,
      status: 'READY',
      files: [file('old.pdf', 'INDEXED'), file('doc.pdf', 'FAILED')],
    });
    uploadAndWait = $$.SANDBOX.stub().resolves({ outcome: 'INDEXED', files: [file('doc.pdf', 'INDEXED')] });
    deleteFiles = $$.SANDBOX.stub().resolves({ deleted: ['doc.pdf'], failed: [] });

    const realFlow = await import('../../../../src/expressContextFlow.js');
    Cmd = (
      await esmock('../../../../src/commands/agent/express-context/upload.js', {
        '@inquirer/prompts': { select, confirm },
        '@salesforce/agents': { AgentExpressContext: { status } },
        '../../../../src/expressContextFlow.js': {
          ...realFlow,
          uploadAndWait,
          deleteFiles,
          withInterruptFlag: (fn: (i: () => boolean) => Promise<unknown>) => fn(() => false),
        },
      })
    ).default;
  });

  afterEach(() => {
    $$.restore();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('uploads, waits and returns the indexed files', async () => {
    const result = await run();
    expect(result).to.deep.equal({
      libraryId: LIB,
      outcome: 'INDEXED',
      files: [{ fileName: 'doc.pdf', status: 'INDEXED' }],
    });
    expect(uploadAndWait.firstCall.args.slice(1, 3)).to.deep.equal([LIB, [docFile]]);
    expect(deleteFiles.called).to.be.false;
  });

  it('passes a select-backed chooser interactively and none with --json', async () => {
    await run();
    const { choose, log, warn } = uploadAndWait.firstCall.args[3];
    expect(() => log('progress')).to.not.throw();
    expect(() => warn('careful')).to.not.throw();
    expect(await choose('pick', [{ name: 'Abort', value: 'abort' }])).to.equal('abort');
    expect(select.calledOnce).to.be.true;

    await run('--json');
    expect(uploadAndWait.secondCall.args[3].choose).to.be.undefined;
  });

  it('on abort, deletes only the files this run uploaded and never the library', async () => {
    flowUploads(['sf/doc.pdf'], { outcome: 'ABORTED' });
    const err = await rejection(run());
    expect(err.message).to.include('Not all files were indexed');
    expect(confirm.calledOnce).to.be.true;
    expect(deleteFiles.firstCall.args[2].map((f: any) => f.fileName)).to.deep.equal(['doc.pdf']);
  });

  it('cleans up without prompting in --json mode and reports partial failures', async () => {
    flowUploads(['sf/doc.pdf'], new Error('S3 down'));
    deleteFiles.resolves({ deleted: [], failed: ['doc.pdf: nope'] });
    const err = await rejection(run('--json'));
    expect(err.message).to.include('S3 down');
    expect(confirm.called).to.be.false;
    expect(deleteFiles.calledOnce).to.be.true;
  });

  it('keeps files when the user declines cleanup', async () => {
    flowUploads(['sf/doc.pdf'], { outcome: 'ABORTED' });
    confirm.resolves(false);
    await rejection(run());
    expect(deleteFiles.called).to.be.false;
  });

  it('still cleans up when the cleanup prompt is interrupted', async () => {
    flowUploads(['sf/doc.pdf'], { outcome: 'ABORTED' });
    confirm.rejects(new Error('User force closed the prompt'));
    await rejection(run());
    expect(deleteFiles.calledOnce).to.be.true;
  });

  it('skips cleanup when nothing was uploaded', async () => {
    uploadAndWait.rejects(new Error('url request failed'));
    const err = await rejection(run());
    expect(err.message).to.include('url request failed');
    expect(status.called).to.be.false;
    expect(deleteFiles.called).to.be.false;
  });

  it('skips cleanup when uploaded files are not in the status response', async () => {
    flowUploads(['sf/missing.pdf'], { outcome: 'ABORTED' });
    await rejection(run());
    expect(confirm.called).to.be.false;
    expect(deleteFiles.called).to.be.false;
  });

  it('warns and stops cleanup when the status lookup fails', async () => {
    flowUploads(['sf/doc.pdf'], { outcome: 'ABORTED' });
    status.rejects(new Error('status down'));
    const err = await rejection(run());
    expect(err.message).to.include('Not all files were indexed');
    expect(deleteFiles.called).to.be.false;
  });
});
