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
import { type Connection } from '@salesforce/core';
import { AgentExpressContext, type ExpressContextFileRef } from '@salesforce/agents';
import {
  deleteFiles,
  deleteLibraryRecords,
  findGlobalRetrieverAction,
  isFailed,
  isIndexed,
  MAX_FILE_SIZE,
  MAX_FILES,
  uploadAndWait,
  validateLocalFiles,
  waitForIndexing,
  withInterruptFlag,
  type FlowUi,
  type PartialChoice,
} from '../src/expressContextFlow.js';

const LIB = '1JDSG000009q4rx4AA';
const RETRIEVER = '1CxSG000000VGIe0AO';
const sfPath = (name: string): string => `$agentforce_express_context$/Lib/${name}`;
const file = (name: string, status: string, fileId = `id-${name}`): ExpressContextFileRef => ({
  fileId,
  fileName: name,
  filePath: sfPath(name),
  fileSize: 1,
  status,
});
const statusOf = (...files: ExpressContextFileRef[]) => ({ libraryId: LIB, status: 'READY', files });
const uploadedAs = (...names: string[]) => ({
  libraryId: LIB,
  fileNames: names,
  filePaths: names.map(sfPath),
  status: 'OK',
});

const FAST = { intervalMs: 0 };

describe('expressContextFlow', () => {
  const sandbox = sinon.createSandbox();
  let ui: { log: sinon.SinonStub; warn: sinon.SinonStub; choose?: sinon.SinonStub };
  const conn = {} as Connection;

  beforeEach(() => {
    ui = { log: sandbox.stub(), warn: sandbox.stub(), choose: sandbox.stub() };
  });
  afterEach(() => sandbox.restore());

  describe('status helpers', () => {
    it('classifies statuses', () => {
      expect(isIndexed('INDEXED')).to.be.true;
      expect(isIndexed('INDEXING')).to.be.false;
      expect(isFailed('INDEXING_FAILED')).to.be.true;
      expect(isFailed('Error')).to.be.true;
      expect(isFailed(undefined)).to.be.false;
    });
  });

  describe('waitForIndexing', () => {
    it('polls until all tracked files are indexed and logs only changed progress', async () => {
      const status = sandbox.stub(AgentExpressContext, 'status');
      status.onCall(0).resolves(statusOf(file('a', 'INDEXING')));
      status.onCall(1).resolves(statusOf(file('a', 'INDEXING')));
      status.onCall(2).resolves(statusOf(file('a', 'INDEXED'), file('other', 'INDEXING')));

      const snap = await waitForIndexing(conn, LIB, [sfPath('a')], ui, FAST);

      expect(status.callCount).to.equal(3);
      expect(snap.indexed.map((f) => f.fileName)).to.deep.equal(['a']);
      expect(snap.timedOut).to.be.false;
      expect(ui.log.callCount).to.equal(2);
    });

    it('treats files missing from the status response as pending', async () => {
      sandbox.stub(AgentExpressContext, 'status').resolves({ libraryId: LIB, status: 'READY' });
      const snap = await waitForIndexing(conn, LIB, [sfPath('a')], ui, { intervalMs: 0, timeoutMs: -1 });
      expect(snap.timedOut).to.be.true;
      expect(snap.pending).to.deep.equal([
        { fileId: '', fileName: 'a', filePath: sfPath('a'), fileSize: 0, status: 'PENDING' },
      ]);
    });

    it('returns immediately when every file has failed', async () => {
      sandbox.stub(AgentExpressContext, 'status').resolves(statusOf(file('a', 'FAILED')));
      const snap = await waitForIndexing(conn, LIB, [sfPath('a')], ui, FAST);
      expect(snap.failed).to.have.length(1);
      expect(snap.timedOut).to.be.false;
    });

    it('throws when interrupted', async () => {
      const status = sandbox.stub(AgentExpressContext, 'status');
      try {
        await waitForIndexing(conn, LIB, [sfPath('a')], ui, { ...FAST, isInterrupted: () => true });
        expect.fail('should throw');
      } catch (e) {
        expect((e as Error).name).to.equal('InterruptedError');
      }
      expect(status.called).to.be.false;
    });
  });

  describe('uploadAndWait', () => {
    it('returns INDEXED and reports uploaded paths', async () => {
      sandbox.stub(AgentExpressContext, 'upload').resolves(uploadedAs('a', 'b'));
      sandbox.stub(AgentExpressContext, 'status').resolves(statusOf(file('a', 'INDEXED'), file('b', 'INDEXED')));
      const onUploaded = sandbox.stub();

      const result = await uploadAndWait(conn, LIB, ['./a', './b'], ui, { ...FAST, onUploaded });

      expect(result.outcome).to.equal('INDEXED');
      expect(result.files).to.have.length(2);
      expect(onUploaded.calledOnceWith([sfPath('a'), sfPath('b')])).to.be.true;
      expect(ui.warn.called).to.be.false;
    });

    it('aborts without prompting when no chooser is available (--json)', async () => {
      sandbox.stub(AgentExpressContext, 'upload').resolves(uploadedAs('a', 'b'));
      sandbox.stub(AgentExpressContext, 'status').resolves(statusOf(file('a', 'INDEXED'), file('b', 'FAILED')));
      const noPrompt: FlowUi = { log: ui.log, warn: ui.warn };

      const result = await uploadAndWait(conn, LIB, ['./a', './b'], noPrompt, FAST);

      expect(result.outcome).to.equal('ABORTED');
      const warning = ui.warn.firstCall.args[0] as string;
      expect(warning).to.include('1 of 2');
      expect(warning).to.include('b');
    });

    it('offers continue, retry and abort on partial success and honours continue', async () => {
      sandbox.stub(AgentExpressContext, 'upload').resolves(uploadedAs('a', 'b'));
      sandbox.stub(AgentExpressContext, 'status').resolves(statusOf(file('a', 'INDEXED'), file('b', 'FAILED')));
      ui.choose!.resolves('continue' satisfies PartialChoice);

      const result = await uploadAndWait(conn, LIB, ['./a', './b'], ui, FAST);

      expect(result.outcome).to.equal('PARTIAL');
      const choices = ui.choose!.firstCall.args[1] as Array<{ value: PartialChoice }>;
      expect(choices.map((c) => c.value)).to.deep.equal(['continue', 'retry', 'abort']);
    });

    it('omits continue when nothing indexed, and honours abort', async () => {
      sandbox.stub(AgentExpressContext, 'upload').resolves(uploadedAs('a'));
      sandbox.stub(AgentExpressContext, 'status').resolves(statusOf(file('a', 'FAILED')));
      ui.choose!.resolves('abort');

      const result = await uploadAndWait(conn, LIB, ['./a'], ui, FAST);

      expect(result.outcome).to.equal('ABORTED');
      const choices = ui.choose!.firstCall.args[1] as Array<{ value: PartialChoice }>;
      expect(choices.map((c) => c.value)).to.deep.equal(['retry', 'abort']);
    });

    it('retries once: deletes failed records, re-uploads only those files, then drops the retry choice', async () => {
      const upload = sandbox.stub(AgentExpressContext, 'upload');
      upload.onCall(0).resolves(uploadedAs('a', 'b'));
      upload.onCall(1).resolves(uploadedAs('b'));
      const deleteFile = sandbox.stub(AgentExpressContext, 'deleteFile').resolves();
      const status = sandbox.stub(AgentExpressContext, 'status');
      status.onCall(0).resolves(statusOf(file('a', 'INDEXED'), file('b', 'FAILED', 'old-b')));
      status.onCall(1).resolves(statusOf(file('a', 'INDEXED'), file('b', 'FAILED', 'new-b')));
      ui.choose!.onCall(0).resolves('retry');
      ui.choose!.onCall(1).resolves('continue');
      const onUploaded = sandbox.stub();

      const result = await uploadAndWait(conn, LIB, ['./a', './b'], ui, { ...FAST, onUploaded });

      expect(result.outcome).to.equal('PARTIAL');
      expect(deleteFile.calledOnceWith(conn, LIB, 'old-b')).to.be.true;
      expect(upload.secondCall.args[2]).to.deep.equal(['./b']);
      expect(onUploaded.callCount).to.equal(2);
      const secondChoices = ui.choose!.secondCall.args[1] as Array<{ value: PartialChoice }>;
      expect(secondChoices.map((c) => c.value)).to.deep.equal(['continue', 'abort']);
    });

    it('retries pending files without re-uploading and reports a timeout', async () => {
      const upload = sandbox.stub(AgentExpressContext, 'upload').resolves(uploadedAs('a'));
      const status = sandbox.stub(AgentExpressContext, 'status');
      status.onCall(0).resolves(statusOf(file('a', 'INDEXING')));
      status.onCall(1).resolves(statusOf(file('a', 'INDEXED')));
      ui.choose!.resolves('retry');

      const result = await uploadAndWait(conn, LIB, ['./a'], ui, { intervalMs: 0, timeoutMs: -1 });

      expect(result.outcome).to.equal('INDEXED');
      expect(upload.callCount).to.equal(1);
      expect(ui.warn.firstCall.args[0]).to.match(/0 second|timed out/i);
    });
  });

  describe('findGlobalRetrieverAction', () => {
    const queryConn = (
      ...results: Array<Array<Record<string, unknown>>>
    ): { conn: Connection; query: sinon.SinonStub } => {
      const query = sandbox.stub();
      results.forEach((records, i) => query.onCall(i).resolves({ records }));
      return { conn: { query } as unknown as Connection, query };
    };

    it('returns the global action, polling until it appears', async () => {
      const { conn: c, query } = queryConn(
        [],
        [{ Id: '172x', DeveloperName: 'Lib_RetrieverAction', NamespacePrefix: null }]
      );
      expect(await findGlobalRetrieverAction(c, RETRIEVER, FAST)).to.deep.equal({
        id: '172x',
        developerName: 'Lib_RetrieverAction',
      });
      expect(query.callCount).to.equal(2);
      expect(query.firstCall.args[0]).to.include(`InvocationTarget = '${RETRIEVER}'`).and.include('IsLocal = false');
    });

    it('prefixes a namespace', async () => {
      const { conn: c } = queryConn([{ Id: '172x', DeveloperName: 'A', NamespacePrefix: 'ns' }]);
      expect((await findGlobalRetrieverAction(c, RETRIEVER, FAST)).developerName).to.equal('ns__A');
    });

    it('rejects an invalid retriever ID before querying', async () => {
      const { conn: c, query } = queryConn();
      try {
        await findGlobalRetrieverAction(c, "x' OR Id != '", FAST);
        expect.fail('should throw');
      } catch (e) {
        expect((e as Error).message).to.include("x' OR Id != '");
      }
      expect(query.called).to.be.false;
    });

    it('errors on multiple matches', async () => {
      const { conn: c } = queryConn([
        { Id: '1', DeveloperName: 'A', NamespacePrefix: null },
        { Id: '2', DeveloperName: 'B', NamespacePrefix: null },
      ]);
      try {
        await findGlobalRetrieverAction(c, RETRIEVER, FAST);
        expect.fail('should throw');
      } catch (e) {
        expect((e as Error).message).to.include('A, B');
      }
    });

    it('errors when none appears before the timeout', async () => {
      const { conn: c } = queryConn([]);
      try {
        await findGlobalRetrieverAction(c, RETRIEVER, { intervalMs: 0, timeoutMs: -1 });
        expect.fail('should throw');
      } catch (e) {
        expect((e as Error).message).to.include(RETRIEVER);
      }
    });

    it('throws when interrupted', async () => {
      const { conn: c } = queryConn();
      try {
        await findGlobalRetrieverAction(c, RETRIEVER, { ...FAST, isInterrupted: () => true });
        expect.fail('should throw');
      } catch (e) {
        expect((e as Error).name).to.equal('InterruptedError');
      }
    });
  });

  describe('deleteLibraryRecords', () => {
    const destroyConn = (destroy: sinon.SinonStub): Connection =>
      ({ sobject: () => ({ destroy }) } as unknown as Connection);

    it('deletes the library and the retriever action', async () => {
      const del = sandbox.stub(AgentExpressContext, 'delete').resolves();
      const destroy = sandbox.stub().resolves({ success: true });
      const result = await deleteLibraryRecords(destroyConn(destroy), LIB, '172x');
      expect(result).to.deep.equal({ deleted: [`library ${LIB}`, 'retriever action 172x'], failed: [] });
      expect(del.calledOnce).to.be.true;
      expect(destroy.calledOnceWith('172x')).to.be.true;
    });

    it('reports failures without throwing, and skips a missing action ID', async () => {
      sandbox.stub(AgentExpressContext, 'delete').rejects(new Error('boom'));
      const destroy = sandbox.stub();
      expect(await deleteLibraryRecords(destroyConn(destroy), LIB)).to.deep.equal({
        deleted: [],
        failed: [`library ${LIB}: boom`],
      });
      expect(destroy.called).to.be.false;
    });

    it('reports a failed action delete', async () => {
      sandbox.stub(AgentExpressContext, 'delete').resolves();
      const result = await deleteLibraryRecords(destroyConn(sandbox.stub().rejects(new Error('nope'))), LIB, '172x');
      expect(result.failed).to.deep.equal(['retriever action 172x: nope']);
    });
  });

  describe('deleteFiles', () => {
    it('deletes files with IDs and reports failures', async () => {
      const deleteFile = sandbox.stub(AgentExpressContext, 'deleteFile');
      deleteFile.withArgs(conn, LIB, 'id-a').resolves();
      deleteFile.withArgs(conn, LIB, 'id-b').rejects(new Error('gone'));

      const result = await deleteFiles(conn, LIB, [
        file('a', 'INDEXED'),
        file('b', 'FAILED'),
        file('c', 'PENDING', ''),
      ]);

      expect(result).to.deep.equal({ deleted: ['a'], failed: ['b: gone'] });
      expect(deleteFile.callCount).to.equal(2);
    });
  });

  describe('withInterruptFlag', () => {
    it('turns SIGINT into a flag and restores prior listeners', async () => {
      const prior = (): void => {};
      process.on('SIGINT', prior);
      try {
        const seen = await withInterruptFlag(async (isInterrupted) => {
          expect(process.listeners('SIGINT')).to.not.include(prior);
          expect(isInterrupted()).to.be.false;
          process.emit('SIGINT');
          return isInterrupted();
        });
        expect(seen).to.be.true;
        expect(process.listeners('SIGINT')).to.include(prior);
      } finally {
        process.removeListener('SIGINT', prior);
      }
    });

    it('exits on a second SIGINT', async () => {
      const exit = sandbox.stub(process, 'exit');
      await withInterruptFlag(async () => {
        process.emit('SIGINT');
        process.emit('SIGINT');
      });
      expect(exit.calledOnceWith(130)).to.be.true;
    });

    it('restores listeners when fn throws', async () => {
      const before = process.listenerCount('SIGINT');
      try {
        await withInterruptFlag(() => Promise.reject(new Error('x')));
      } catch {
        /* expected */
      }
      expect(process.listenerCount('SIGINT')).to.equal(before);
    });
  });

  describe('validateLocalFiles', () => {
    it('accepts files within limits', () => {
      expect(() => validateLocalFiles(['a', 'b'], () => 10)).to.not.throw();
    });

    it('rejects too many files', () => {
      const paths = Array.from({ length: MAX_FILES + 1 }, (_, i) => `f${i}`);
      expect(() => validateLocalFiles(paths, () => 1)).to.throw(String(MAX_FILES));
    });

    it('rejects files over the size limit, naming them', () => {
      expect(() =>
        validateLocalFiles(['/x/big.pdf', '/x/ok.pdf'], (p) => (p.includes('big') ? MAX_FILE_SIZE + 1 : 1))
      ).to.throw('big.pdf');
    });
  });
});
