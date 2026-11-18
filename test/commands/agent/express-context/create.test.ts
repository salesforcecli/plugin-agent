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

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';

const SCRIPT = [
  'config:',
  '    developer_name: "My_Agent"',
  '',
  'subagent general_faq:',
  '    label: "General FAQ"',
  '    reasoning:',
  '        instructions: ->',
  '            | Answer questions.',
  '',
  'subagent billing:',
  '    label: "Billing"',
  '',
].join('\n');

const LIBRARY = {
  libraryId: '1JDSG000009q4rx4AA',
  developerName: 'General_FAQ_Express',
  masterLabel: 'General FAQ Express',
  retriever: { id: '1CxSG000000VGIe0AO', apiName: 'General_FAQ_Express_Retriever_1Cx_ABC' },
  retrieverAction: { id: '172SG0000000001AAA', apiName: 'General_FAQ_Express_RetrieverAction' },
};
const GLOBAL_ACTION = { id: '172SG0000000002AAA', developerName: 'General_FAQ_Express_RetrieverAction' };
const INDEXED = {
  outcome: 'INDEXED',
  files: [{ fileId: 'f1', fileName: 'doc.pdf', filePath: 'p', fileSize: 1, status: 'INDEXED' }],
};

describe('agent express-context create', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let tmp: string;
  let agentFile: string;
  let docFile: string;
  let Cmd: any;

  let select: sinon.SinonStub;
  let input: sinon.SinonStub;
  let confirm: sinon.SinonStub;
  let promptForAgentFiles: sinon.SinonStub;
  let findAuthoringBundle: sinon.SinonStub;
  let aec: { list: sinon.SinonStub; create: sinon.SinonStub; get: sinon.SinonStub };
  let flow: {
    uploadAndWait: sinon.SinonStub;
    findGlobalRetrieverAction: sinon.SinonStub;
    deleteLibraryRecords: sinon.SinonStub;
  };

  const agentFlags = [
    '--authoring-bundle',
    'My_Agent',
    '--subagent',
    'general_faq',
    '--action-label',
    'FAQ Search',
    '--action-description',
    'Searches the FAQ',
  ];
  const run = (...args: string[]): Promise<any> =>
    Cmd.run(['--target-org', testOrg.username, '--file', docFile, ...args]);
  const rejection = async (p: Promise<unknown>): Promise<Error> => {
    try {
      await p;
    } catch (e) {
      return e as Error;
    }
    throw new Error('expected rejection');
  };

  beforeEach(async () => {
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
    stubSfCommandUx($$.SANDBOX);

    tmp = mkdtempSync(join(tmpdir(), 'aec-create-'));
    agentFile = join(tmp, 'My_Agent.agent');
    writeFileSync(agentFile, SCRIPT);
    docFile = join(tmp, 'doc.pdf');
    writeFileSync(docFile, 'pdf');

    select = $$.SANDBOX.stub().callsFake(({ choices }: { choices: Array<{ value: string }> }) =>
      Promise.resolve(choices[0].value)
    );
    input = $$.SANDBOX.stub();
    input.onFirstCall().resolves('FAQ Search');
    input.onSecondCall().resolves('Searches the FAQ');
    confirm = $$.SANDBOX.stub().resolves(true);
    promptForAgentFiles = $$.SANDBOX.stub().resolves('My_Agent');
    findAuthoringBundle = $$.SANDBOX.stub().returns(tmp);
    aec = {
      list: $$.SANDBOX.stub().resolves({ libraries: [] }),
      create: $$.SANDBOX.stub().resolves(LIBRARY),
      get: $$.SANDBOX.stub(),
    };
    flow = {
      uploadAndWait: $$.SANDBOX.stub().resolves(INDEXED),
      findGlobalRetrieverAction: $$.SANDBOX.stub().resolves(GLOBAL_ACTION),
      deleteLibraryRecords: $$.SANDBOX.stub().resolves({ deleted: ['library x'], failed: [] }),
    };

    const realFlow = await import('../../../../src/expressContextFlow.js');
    Cmd = (
      await esmock('../../../../src/commands/agent/express-context/create.js', {
        '@inquirer/prompts': { select, input, confirm },
        '../../../../src/flags.js': { promptForAgentFiles },
        '@salesforce/agents': { AgentExpressContext: aec, findAuthoringBundle },
        '../../../../src/expressContextFlow.js': {
          ...realFlow,
          ...flow,
          withInterruptFlag: (fn: (i: () => boolean) => Promise<unknown>) => fn(() => false),
        },
      })
    ).default;

    $$.SANDBOX.stub(SfProject, 'resolve').resolves({
      getPackageDirectories: () => [{ fullPath: tmp }],
    } as unknown as SfProject);
  });

  afterEach(() => {
    $$.restore();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('prompts for everything, creates the library, waits for indexing and adds the action', async () => {
    const result = await run();

    expect(promptForAgentFiles.calledOnce).to.be.true;
    expect(select.firstCall.args[0].choices.map((c: any) => c.name)).to.deep.equal([
      'General FAQ (general_faq)',
      'Billing (billing)',
    ]);
    expect(input.callCount).to.equal(2);
    expect(confirm.calledOnce).to.be.true;
    expect(aec.create.firstCall.args[1]).to.deep.equal({
      masterLabel: 'General FAQ Express',
      developerName: 'General_FAQ_Express',
      description: 'Searches the FAQ',
    });
    expect(flow.findGlobalRetrieverAction.firstCall.args[1]).to.equal(LIBRARY.retriever.id);
    expect(flow.uploadAndWait.firstCall.args.slice(1, 3)).to.deep.equal([LIBRARY.libraryId, [docFile]]);

    const script = readFileSync(agentFile, 'utf8');
    expect(script).to.include(
      '        General_FAQ_Express_RetrieverAction:\n            description: "Searches the FAQ"'
    );
    expect(script).to.include('source: "General_FAQ_Express_RetrieverAction"');
    expect(script).to.include(`target: "retriever://${LIBRARY.retriever.apiName}"`);
    expect(script).to.include('@actions.General_FAQ_Express_RetrieverAction');

    expect(result).to.deep.include({
      libraryId: LIBRARY.libraryId,
      retriever: LIBRARY.retriever.apiName,
      retrieverAction: GLOBAL_ACTION.developerName,
      outcome: 'INDEXED',
    });
    expect(result.agentAction).to.deep.equal({
      authoringBundle: 'My_Agent',
      subagent: 'general_faq',
      actionName: GLOBAL_ACTION.developerName,
      label: 'FAQ Search',
      filePath: agentFile,
    });
    expect(flow.deleteLibraryRecords.called).to.be.false;
  });

  it('uses flags without prompting in --json mode', async () => {
    const result = await run('--json', ...agentFlags);
    expect(promptForAgentFiles.called || select.called || input.called || confirm.called).to.be.false;
    expect(result.outcome).to.equal('INDEXED');
    expect(flow.uploadAndWait.firstCall.args[3].choose).to.be.undefined;
  });

  it('falls back to GET for the retriever when create omits it', async () => {
    aec.create.resolves({ ...LIBRARY, retriever: undefined });
    aec.get.resolves({ retriever: LIBRARY.retriever });
    await run(...agentFlags);
    expect(aec.get.calledOnce).to.be.true;
  });

  describe('validation before any org call', () => {
    const noOrgCalls = (): void => {
      expect(aec.list.called).to.be.false;
      expect(aec.create.called).to.be.false;
    };

    it('requires the agent flags with --json', async () => {
      const err = await rejection(run('--json', '--subagent', 'general_faq'));
      expect(err.message).to.include('authoring-bundle, action-label, action-description');
      noOrgCalls();
    });

    it('errors when the bundle is not found', async () => {
      findAuthoringBundle.returns(undefined);
      expect((await rejection(run(...agentFlags))).message).to.include('"My_Agent" wasn\'t found');
      noOrgCalls();
    });

    it('errors when there is no project', async () => {
      (SfProject.resolve as sinon.SinonStub).rejects(new Error('no project'));
      expect((await rejection(run(...agentFlags))).message).to.include('Salesforce DX project');
      noOrgCalls();
    });

    it('errors when the bundle has no subagents', async () => {
      writeFileSync(agentFile, 'config:\n    developer_name: "X"\n');
      expect((await rejection(run(...agentFlags))).message).to.include("doesn't define any subagents");
      noOrgCalls();
    });

    it('errors on an unknown --subagent, listing the available ones', async () => {
      const err = await rejection(run('--subagent', 'nope'));
      expect(err.message).to.include('general_faq, billing');
      noOrgCalls();
    });

    it('errors when the subagent already has the action', async () => {
      writeFileSync(
        agentFile,
        SCRIPT.replace(
          '    label: "Billing"',
          '    label: "Billing"\n    actions:\n        Billing_Express_RetrieverAction:\n            target: "x"'
        )
      );
      const err = await rejection(run('--subagent', 'billing'));
      expect(err.message).to.include('already has an action named "Billing_Express_RetrieverAction"');
      noOrgCalls();
    });

    it('validates that prompted values are not empty', async () => {
      await run();
      const { validate } = input.firstCall.args[0];
      expect(validate('  ')).to.be.a('string');
      expect(validate('x')).to.be.true;
    });

    it('stops when the user declines the plan', async () => {
      confirm.resolves(false);
      expect((await rejection(run())).message).to.include('Nothing was created');
      noOrgCalls();
    });
  });

  describe('org errors before the library exists', () => {
    it('errors and suggests upload when a library with the same name exists', async () => {
      aec.list.resolves({
        libraries: [{ libraryId: '1JDx', masterLabel: 'Other', developerName: 'General_FAQ_Express_1a2b3c4d' }],
      });
      const err = await rejection(run(...agentFlags));
      expect(err.message).to.include('already exists (1JDx)');
      expect(aec.create.called).to.be.false;
    });

    it('wraps list failures', async () => {
      aec.list.rejects(new Error('list down'));
      expect((await rejection(run(...agentFlags))).message).to.include('list down');
    });

    it('wraps create failures without cleanup', async () => {
      aec.create.rejects(new Error('create down'));
      expect((await rejection(run(...agentFlags))).message).to.include('create down');
      expect(flow.deleteLibraryRecords.called).to.be.false;
    });
  });

  describe('cleanup after the library exists', () => {
    it('deletes the library and global action when indexing is aborted (confirmed)', async () => {
      flow.uploadAndWait.resolves({ outcome: 'ABORTED', files: [] });
      const err = await rejection(run(...agentFlags));
      expect(err.message).to.include('Not all files were indexed');
      expect(confirm.callCount).to.equal(2); // proceed + cleanup
      expect(flow.deleteLibraryRecords.firstCall.args.slice(1)).to.deep.equal([LIBRARY.libraryId, GLOBAL_ACTION.id]);
      expect(readFileSync(agentFile, 'utf8')).to.equal(SCRIPT);
    });

    it('deletes without prompting in --json mode and reports partial failures', async () => {
      flow.uploadAndWait.rejects(new Error('upload down'));
      flow.deleteLibraryRecords.resolves({ deleted: [], failed: ['library x: nope'] });
      const err = await rejection(run('--json', ...agentFlags));
      expect(err.message).to.include('upload down');
      expect(confirm.called).to.be.false;
      expect(flow.deleteLibraryRecords.calledOnce).to.be.true;
    });

    it('keeps records when the user declines cleanup', async () => {
      flow.findGlobalRetrieverAction.rejects(new Error('no action'));
      confirm.onSecondCall().resolves(false);
      await rejection(run(...agentFlags));
      expect(flow.deleteLibraryRecords.called).to.be.false;
    });

    it('still cleans up when the cleanup prompt is interrupted, using the create response action ID', async () => {
      flow.findGlobalRetrieverAction.rejects(new Error('no action'));
      confirm.onSecondCall().rejects(new Error('User force closed the prompt'));
      await rejection(run(...agentFlags));
      expect(flow.deleteLibraryRecords.firstCall.args[2]).to.equal(LIBRARY.retrieverAction.id);
    });

    it('cleans up when the retriever is missing', async () => {
      aec.create.resolves({ ...LIBRARY, retriever: undefined });
      aec.get.resolves({});
      const err = await rejection(run('--json', ...agentFlags));
      expect(err.message).to.include(LIBRARY.libraryId);
      expect(flow.deleteLibraryRecords.calledOnce).to.be.true;
    });

    it('cleans up when the action already exists by the time indexing finishes', async () => {
      flow.uploadAndWait.callsFake(async () => {
        writeFileSync(
          agentFile,
          SCRIPT.replace(
            '            | Answer questions.',
            '            | Answer questions.\n    actions:\n        General_FAQ_Express_RetrieverAction:\n            target: "x"'
          )
        );
        return INDEXED;
      });
      await rejection(run('--json', ...agentFlags));
      expect(flow.deleteLibraryRecords.calledOnce).to.be.true;
    });
  });

  it('passes an interactive chooser to the flow that uses select', async () => {
    await run(...agentFlags);
    const { choose, log, warn } = flow.uploadAndWait.firstCall.args[3];
    expect(() => log('progress')).to.not.throw();
    expect(() => warn('careful')).to.not.throw();
    select.resetHistory();
    expect(await choose('pick', [{ name: 'Abort', value: 'abort' }])).to.equal('abort');
    expect(select.calledOnce).to.be.true;
  });
});
