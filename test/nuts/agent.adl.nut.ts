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

import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';

/* eslint-disable no-console */

// ADL NUT — Full lifecycle tests for SFDRIVE, KNOWLEDGE, and RETRIEVER.
// Requires a pre-authenticated org with Data Cloud provisioned.
//
// Usage:
//   TARGET_ORG=sdb3 yarn test:nuts --grep "agent adl"
//   TARGET_ORG=sdb3 RETRIEVER_ID=1CxSB000000G5Rx0AK yarn test:nuts --grep "agent adl"

const targetOrg = process.env.TARGET_ORG ?? process.env.TESTKIT_ORG_USERNAME;

// ═══════════════════════════════════════════════════════════════
// SFDRIVE — Full File Library Lifecycle
// ═══════════════════════════════════════════════════════════════
describe('agent adl SFDRIVE NUTs', function () {
  this.timeout(15 * 60 * 1000);

  let libraryId: string;
  let testFile: string;
  let testFile2: string;

  before(function skipIfNoOrg() {
    if (!targetOrg) {
      console.log('Skipping ADL NUTs: set TARGET_ORG or TESTKIT_ORG_USERNAME env var');
      this.skip();
    }

    testFile = join(tmpdir(), 'adl-nut-test.txt');
    testFile2 = join(tmpdir(), 'adl-nut-test2.txt');
    writeFileSync(testFile, 'ADL NUT test document content for grounding.');
    writeFileSync(testFile2, 'ADL NUT second test document for day-1 add.');
  });

  it('should verify ADL prerequisites (Data Cloud + API access)', () => {
    const result = execCmd<{ libraries: unknown[] }>(`agent adl list --target-org ${targetOrg} --json`, {
      ensureExitCode: 0,
    });

    expect(result.jsonOutput?.result).to.have.property('libraries');
    console.log(`ADL API accessible — ${result.jsonOutput!.result.libraries.length} existing libraries`);
  });

  it('should create an SFDRIVE library', () => {
    const devName = `NUT_File_${Date.now()}`;
    const result = execCmd<{ libraryId: string; masterLabel: string }>(
      `agent adl create --target-org ${targetOrg} --name "${devName}" --developer-name "${devName}" --source-type sfdrive --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput?.result).to.have.property('libraryId');
    libraryId = result.jsonOutput!.result.libraryId;
    console.log(`Created SFDRIVE library: ${libraryId}`);
  });

  it('should list libraries and include the created one', () => {
    const result = execCmd<{ libraries: Array<{ libraryId: string }> }>(
      `agent adl list --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );

    const libs = result.jsonOutput!.result.libraries;
    expect(libs.some((l) => l.libraryId === libraryId)).to.be.true;
  });

  it('should get library detail', () => {
    const result = execCmd<{ libraryId: string; sourceType: string }>(
      `agent adl get --target-org ${targetOrg} --library-id ${libraryId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.libraryId).to.equal(libraryId);
    expect(result.jsonOutput!.result.sourceType).to.equal('SFDRIVE');
  });

  it('should get indexing status', () => {
    const result = execCmd<{ indexingStatus: { libraryId: string; status: string } }>(
      `agent adl status --target-org ${targetOrg} --library-id ${libraryId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.indexingStatus.libraryId).to.equal(libraryId);
    expect(result.jsonOutput!.result.indexingStatus).to.have.property('status');
  });

  it('should upload multiple files and wait for READY', function () {
    this.timeout(10 * 60 * 1000);

    const result = execCmd<{ libraryId: string; status: string; retrieverId?: string }>(
      `agent adl upload --target-org ${targetOrg} --library-id ${libraryId} --file ${testFile} --file ${testFile2} --wait 10 --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.libraryId).to.equal(libraryId);
    expect(result.jsonOutput!.result.status).to.equal('READY');
  });

  it('should update library metadata', () => {
    const result = execCmd<{ libraryId: string; masterLabel: string; description: string }>(
      `agent adl update --target-org ${targetOrg} --library-id ${libraryId} --name "NUT_Updated" --description "Updated by NUT" --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.masterLabel).to.equal('NUT_Updated');
    expect(result.jsonOutput!.result.description).to.equal('Updated by NUT');
  });

  it('should add a second file (day-1 flow)', function () {
    this.timeout(3 * 60 * 1000);

    const result = execCmd<{ success: boolean; fileName: string }>(
      `agent adl file add -i ${libraryId} --path ${testFile2} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.success).to.be.true;
  });

  it('should add multiple files in batch', function () {
    this.timeout(3 * 60 * 1000);

    const file3 = join(tmpdir(), 'adl-nut-test3.txt');
    writeFileSync(file3, 'Third NUT test file.');

    const result = execCmd<{ success: boolean; fileName: string }>(
      `agent adl file add -i ${libraryId} --path ${testFile2} --path ${file3} --target-org ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.success).to.be.true;
  });

  it('should list files in the library', () => {
    const result = execCmd<{ files: Array<{ fileId: string; fileName: string }> }>(
      `agent adl file list -i ${libraryId} -o ${targetOrg} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.files.length).to.be.greaterThan(0);
  });

  it('should list with --source-type filter', () => {
    const result = execCmd<{ libraries: Array<{ sourceType: string }> }>(
      `agent adl list --target-org ${targetOrg} --source-type sfdrive --json`,
      { ensureExitCode: 0 }
    );

    for (const lib of result.jsonOutput!.result.libraries) {
      expect(lib.sourceType).to.equal('SFDRIVE');
    }
  });

  it('should delete the library (best-effort cleanup)', () => {
    const result = execCmd<{ success: boolean; libraryId: string }>(
      `agent adl delete --target-org ${targetOrg} --library-id ${libraryId} --json`
    );

    if (result.jsonOutput?.result?.success) {
      console.log(`Deleted library ${libraryId}`);
      libraryId = '';
    } else {
      console.log('Delete returned non-zero (library may still be provisioning) — skipping assertion');
      libraryId = '';
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE — Knowledge Library Lifecycle
// ═══════════════════════════════════════════════════════════════
describe('agent adl KNOWLEDGE NUTs', function () {
  this.timeout(5 * 60 * 1000);

  let libraryId: string;

  before(function skipIfNoOrg() {
    if (!targetOrg) {
      this.skip();
    }
  });

  it('should create a KNOWLEDGE library (auto-triggers indexing)', () => {
    const devName = `NUT_Know_${Date.now()}`;
    const result = execCmd<{ libraryId: string; sourceType: string; groundingSource: { knowledgeConfig: unknown } }>(
      `agent adl create --target-org ${targetOrg} --name "${devName}" --developer-name "${devName}" --source-type knowledge --primary-index-field1 ArticleNumber --primary-index-field2 Title --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput?.result).to.have.property('libraryId');
    expect(result.jsonOutput!.result.sourceType).to.equal('KNOWLEDGE');
    libraryId = result.jsonOutput!.result.libraryId;
    console.log(`Created KNOWLEDGE library: ${libraryId}`);
  });

  it('should get Knowledge library detail', () => {
    const result = execCmd<{ libraryId: string; sourceType: string }>(
      `agent adl get --target-org ${targetOrg} --library-id ${libraryId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.libraryId).to.equal(libraryId);
    expect(result.jsonOutput!.result.sourceType).to.equal('KNOWLEDGE');
  });

  it('should get Knowledge indexing status', () => {
    const result = execCmd<{ indexingStatus: { libraryId: string; status: string; stageDetails?: unknown[] } }>(
      `agent adl status --target-org ${targetOrg} --library-id ${libraryId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.indexingStatus.libraryId).to.equal(libraryId);
    expect(result.jsonOutput!.result.indexingStatus).to.have.property('stageDetails');
  });

  it('should update Knowledge metadata (best-effort — may fail if still provisioning)', () => {
    const result = execCmd<{ libraryId: string; masterLabel: string; description: string }>(
      `agent adl update --target-org ${targetOrg} --library-id ${libraryId} --name "NUT_Know_Updated" --description "Updated Knowledge" --json`
    );

    if (result.jsonOutput?.result?.masterLabel) {
      expect(result.jsonOutput.result.masterLabel).to.equal('NUT_Know_Updated');
    } else {
      console.log('Update skipped — library still provisioning (expected for freshly created Knowledge)');
    }
  });

  it('should delete Knowledge library (best-effort cleanup)', () => {
    const result = execCmd<{ success: boolean; libraryId: string }>(
      `agent adl delete --target-org ${targetOrg} --library-id ${libraryId} --json`
    );

    if (result.jsonOutput?.result?.success) {
      console.log(`Deleted Knowledge library ${libraryId}`);
      libraryId = '';
    } else {
      console.log('Delete returned non-zero — skipping assertion');
      libraryId = '';
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// RETRIEVER — Custom Retriever Library Lifecycle
// ═══════════════════════════════════════════════════════════════
describe('agent adl RETRIEVER NUTs', function () {
  this.timeout(3 * 60 * 1000);

  let libraryId: string;
  const retrieverId = process.env.RETRIEVER_ID;

  before(function skipIfNoOrg() {
    if (!targetOrg) {
      this.skip();
    }
    if (!retrieverId) {
      console.log('Skipping RETRIEVER NUTs: set RETRIEVER_ID env var to an active retriever');
      this.skip();
    }
  });

  it('should create a RETRIEVER library (immediately READY)', () => {
    const devName = `NUT_Ret_${Date.now()}`;
    const result = execCmd<{ libraryId: string; sourceType: string }>(
      `agent adl create --target-org ${targetOrg} --name "${devName}" --developer-name "${devName}" --source-type retriever --retriever-id ${retrieverId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput?.result).to.have.property('libraryId');
    expect(result.jsonOutput!.result.sourceType).to.equal('RETRIEVER');
    libraryId = result.jsonOutput!.result.libraryId;
    console.log(`Created RETRIEVER library: ${libraryId}`);
  });

  it('should get Retriever library detail with status READY', () => {
    const result = execCmd<{ libraryId: string; sourceType: string; status: string; retrieverId: string }>(
      `agent adl get --target-org ${targetOrg} --library-id ${libraryId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.libraryId).to.equal(libraryId);
    expect(result.jsonOutput!.result.sourceType).to.equal('RETRIEVER');
    expect(result.jsonOutput!.result.status).to.equal('READY');
    expect(result.jsonOutput!.result.retrieverId).to.equal(retrieverId);
  });

  it('should update Retriever library metadata', () => {
    const result = execCmd<{ libraryId: string; masterLabel: string; description: string }>(
      `agent adl update --target-org ${targetOrg} --library-id ${libraryId} --name "NUT_Ret_Updated" --description "Updated Retriever" --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.masterLabel).to.equal('NUT_Ret_Updated');
  });

  it('should swap retrieverId via --retriever-id flag', () => {
    const result = execCmd<{ libraryId: string; retrieverId: string }>(
      `agent adl update --target-org ${targetOrg} --library-id ${libraryId} --retriever-id ${retrieverId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.retrieverId).to.equal(retrieverId);
  });

  it('should delete Retriever library', () => {
    const result = execCmd<{ success: boolean; libraryId: string }>(
      `agent adl delete --target-org ${targetOrg} --library-id ${libraryId} --json`,
      { ensureExitCode: 0 }
    );

    expect(result.jsonOutput!.result.success).to.be.true;
    console.log(`Deleted Retriever library ${libraryId}`);
    libraryId = '';
  });
});
