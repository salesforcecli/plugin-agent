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
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { SfError } from '@salesforce/core';
import { SfCommand, stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { AgentExpressContext } from '@salesforce/agents';
import AgentExpressContextList from '../../../../src/commands/agent/express-context/list.js';
import AgentExpressContextGet from '../../../../src/commands/agent/express-context/get.js';
import AgentExpressContextStatus from '../../../../src/commands/agent/express-context/status.js';
import AgentExpressContextFiles from '../../../../src/commands/agent/express-context/files.js';
import AgentExpressContextDelete from '../../../../src/commands/agent/express-context/delete.js';

const LIB = '1JDSG000009q4rx4AA';
const library = { libraryId: LIB, masterLabel: 'FAQ Express', developerName: 'FAQ_Express_6def866f', status: 'READY' };

describe('agent express-context read/delete commands', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let ux: ReturnType<typeof stubSfCommandUx>;

  const rejection = async (p: Promise<unknown>): Promise<SfError> => {
    try {
      await p;
    } catch (e) {
      return e as SfError;
    }
    throw new Error('expected rejection');
  };
  const apiError = (): SfError => new SfError('Library not found', 'NOT_FOUND');

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    ux = stubSfCommandUx($$.SANDBOX);
  });

  describe('list', () => {
    it('returns the libraries and renders a table', async () => {
      const list = $$.SANDBOX.stub(AgentExpressContext, 'list').resolves({ libraries: [library] });
      const result = await AgentExpressContextList.run(['--target-org', testOrg.username]);
      expect(result).to.deep.equal({ libraries: [library] });
      expect(list.calledOnce).to.be.true;
      expect(ux.table.calledOnce).to.be.true;
    });

    it('does not render a table with --json', async () => {
      $$.SANDBOX.stub(AgentExpressContext, 'list').resolves({ libraries: [library] });
      await AgentExpressContextList.run(['--target-org', testOrg.username, '--json']);
      expect(ux.table.called).to.be.false;
    });

    it('wraps API errors as ListFailed with exit code 4', async () => {
      $$.SANDBOX.stub(AgentExpressContext, 'list').rejects(apiError());
      const err = await rejection(AgentExpressContextList.run(['--target-org', testOrg.username]));
      expect(err.name).to.equal('ListFailed');
      expect(err.exitCode).to.equal(4);
      expect(err.message).to.include('Library not found');
    });
  });

  describe('get', () => {
    it('fetches the library by --library-id', async () => {
      const get = $$.SANDBOX.stub(AgentExpressContext, 'get').resolves(library);
      const result = await AgentExpressContextGet.run(['--target-org', testOrg.username, '--library-id', LIB]);
      expect(result).to.deep.equal(library);
      expect(get.firstCall.args[1]).to.equal(LIB);
    });

    it('surfaces the API error with exit code 4', async () => {
      $$.SANDBOX.stub(AgentExpressContext, 'get').rejects(apiError());
      const err = await rejection(AgentExpressContextGet.run(['--target-org', testOrg.username, '-i', LIB]));
      expect(err.name).to.equal('NOT_FOUND');
      expect(err.exitCode).to.equal(4);
    });
  });

  describe('status', () => {
    it('returns the status response for the library', async () => {
      const response = { libraryId: LIB, status: 'READY', filesTotal: 1, filesIndexed: 1 };
      const status = $$.SANDBOX.stub(AgentExpressContext, 'status').resolves(response);
      const result = await AgentExpressContextStatus.run(['--target-org', testOrg.username, '-i', LIB]);
      expect(result).to.deep.equal(response);
      expect(status.firstCall.args[1]).to.equal(LIB);
    });

    it('surfaces the API error with exit code 4', async () => {
      $$.SANDBOX.stub(AgentExpressContext, 'status').rejects(apiError());
      const err = await rejection(AgentExpressContextStatus.run(['--target-org', testOrg.username, '-i', LIB]));
      expect(err.exitCode).to.equal(4);
    });
  });

  describe('files', () => {
    it('returns the file list and renders a table', async () => {
      const response = {
        files: [{ fileId: 'f1', fileName: 'a.pdf', filePath: 'sf/a.pdf', fileSize: 3, status: 'INDEXED' }],
      };
      const listFiles = $$.SANDBOX.stub(AgentExpressContext, 'listFiles').resolves(response);
      const result = await AgentExpressContextFiles.run(['--target-org', testOrg.username, '-i', LIB]);
      expect(result).to.deep.equal(response);
      expect(listFiles.firstCall.args[1]).to.equal(LIB);
      expect(ux.table.calledOnce).to.be.true;
    });

    it('surfaces the API error with exit code 4', async () => {
      $$.SANDBOX.stub(AgentExpressContext, 'listFiles').rejects(apiError());
      const err = await rejection(AgentExpressContextFiles.run(['--target-org', testOrg.username, '-i', LIB]));
      expect(err.exitCode).to.equal(4);
    });
  });

  describe('delete', () => {
    it('deletes without prompting when --no-prompt is set', async () => {
      const confirm = $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(true);
      const del = $$.SANDBOX.stub(AgentExpressContext, 'delete').resolves();
      const result = await AgentExpressContextDelete.run(['--target-org', testOrg.username, '-i', LIB, '--no-prompt']);
      expect(result).to.deep.equal({ libraryId: LIB, deleted: true });
      expect(confirm.called).to.be.false;
      expect(del.firstCall.args[1]).to.equal(LIB);
    });

    it('deletes after the user confirms', async () => {
      $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(true);
      const del = $$.SANDBOX.stub(AgentExpressContext, 'delete').resolves();
      const result = await AgentExpressContextDelete.run(['--target-org', testOrg.username, '-i', LIB]);
      expect(result.deleted).to.be.true;
      expect(del.calledOnce).to.be.true;
    });

    it('does nothing when the user declines', async () => {
      $$.SANDBOX.stub(SfCommand.prototype, 'confirm').resolves(false);
      const del = $$.SANDBOX.stub(AgentExpressContext, 'delete').resolves();
      const result = await AgentExpressContextDelete.run(['--target-org', testOrg.username, '-i', LIB]);
      expect(result).to.deep.equal({ libraryId: LIB, deleted: false });
      expect(del.called).to.be.false;
    });

    it('surfaces the API error with exit code 4', async () => {
      $$.SANDBOX.stub(AgentExpressContext, 'delete').rejects(apiError());
      const err = await rejection(
        AgentExpressContextDelete.run(['--target-org', testOrg.username, '-i', LIB, '--no-prompt'])
      );
      expect(err.name).to.equal('NOT_FOUND');
      expect(err.exitCode).to.equal(4);
    });
  });
});
