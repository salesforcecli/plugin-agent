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
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { expect } from 'chai';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { buildScorerXml, addVersionToScorerXml, parseScorerVersions, type ScorerSpec } from '@salesforce/agents';
import type { AgentScorerEditResult } from '../../src/commands/agent/scorer/edit.js';

// `agent scorer edit` is a purely local XML edit — it needs NO org connection — so this NUT runs against a bare
// project with no scratch org. It authors a scorer fixture on disk (via the agents lib, the same way `create`
// would), then exercises the real command end to end: status changes, activation toggles, and the error paths.
describe('agent scorer edit NUTs', () => {
  const API_NAME = 'Nut_Edit_Scorer';
  // A `Manual`-engine scorer needs no prompt template, keeping the fixture self-contained.
  const spec: ScorerSpec = {
    apiName: API_NAME,
    lightningType: 'lightning__textType',
    inputScope: 'Session',
    label: 'NUT Edit Scorer',
    engineType: 'Manual',
    status: 'Draft',
    agentAssociation: { agentApiName: 'My_Agent', isActive: false },
  };

  let session: TestSession;
  let outputDir: string;
  let scorerPath: string;

  before(async () => {
    session = await TestSession.create({ project: { name: 'scorerEditNut' } });
    outputDir = join(session.project.dir, 'force-app', 'main', 'default');
    scorerPath = join(outputDir, 'aiAgentScorerDefinitions', `${API_NAME}.aiAgentScorerDefinition-meta.xml`);
  });

  after(async () => {
    await session?.clean();
  });

  /** (Re)author a fresh two-version fixture (v1, v2 — both Draft, inactive) so each test starts from a known state. */
  function authorFixture(active = false): void {
    const seed = active
      ? { ...spec, agentAssociation: { agentApiName: 'My_Agent', isActive: true } }
      : spec;
    let xml = buildScorerXml(seed);
    ({ xml } = addVersionToScorerXml(xml, seed));
    mkdirSync(join(outputDir, 'aiAgentScorerDefinitions'), { recursive: true });
    writeFileSync(scorerPath, xml);
  }

  const versionsOnDisk = (): ReturnType<typeof parseScorerVersions> => parseScorerVersions(readFileSync(scorerPath, 'utf8'));

  beforeEach(() => authorFixture());

  it('promotes a version to Available with --status Available', () => {
    const result = execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 2 --status Available --output-dir "${outputDir}" --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result?.apiName).to.equal(API_NAME);
    const versions = versionsOnDisk();
    expect(versions.find((v) => v.versionNumber === 2)?.status).to.equal('Available');
    // untouched versions keep their status
    expect(versions.find((v) => v.versionNumber === 1)?.status).to.equal('Draft');
  });

  it('archives a version with --status Archived', () => {
    execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 1 --status Archived --output-dir "${outputDir}" --json`,
      { ensureExitCode: 0 }
    );

    expect(versionsOnDisk().find((v) => v.versionNumber === 1)?.status).to.equal('Archived');
  });

  it('activates the agent association with --activate', () => {
    execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 2 --activate --output-dir "${outputDir}" --json`,
      { ensureExitCode: 0 }
    );

    expect(versionsOnDisk().find((v) => v.versionNumber === 2)?.isActive).to.equal(true);
  });

  it('deactivates the agent association with --deactivate', () => {
    authorFixture(true);
    execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 2 --deactivate --output-dir "${outputDir}" --json`,
      { ensureExitCode: 0 }
    );

    expect(versionsOnDisk().find((v) => v.versionNumber === 2)?.isActive).to.equal(false);
  });

  it('changes status and activation together in a single invocation', () => {
    execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 2 --status Available --activate --output-dir "${outputDir}" --json`,
      { ensureExitCode: 0 }
    );

    const v2 = versionsOnDisk().find((v) => v.versionNumber === 2);
    expect(v2?.status).to.equal('Available');
    expect(v2?.isActive).to.equal(true);
  });

  it('writes nothing with --preview but prints the resulting XML', () => {
    const before = readFileSync(scorerPath, 'utf8');
    const output = execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 2 --status Available --output-dir "${outputDir}" --preview`,
      { ensureExitCode: 0 }
    );

    // file untouched...
    expect(readFileSync(scorerPath, 'utf8')).to.equal(before);
    expect(versionsOnDisk().find((v) => v.versionNumber === 2)?.status).to.equal('Draft');
    // ...but the promoted XML was printed
    expect(output.shellOutput.stdout).to.include('<status>Available</status>');
  });

  it('errors when neither --status nor --activate/--deactivate is provided', () => {
    const output = execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 1 --output-dir "${outputDir}" --json`,
      { ensureExitCode: 1 }
    ).jsonOutput;

    expect(output?.message).to.match(/status|activate|deactivate/);
  });

  it('rejects --activate together with --deactivate', () => {
    execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 1 --activate --deactivate --output-dir "${outputDir}" --json`,
      { ensureExitCode: 'nonZero' }
    );
  });

  it('errors on an unknown version', () => {
    const output = execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name ${API_NAME} --version 9 --status Available --output-dir "${outputDir}" --json`,
      { ensureExitCode: 1 }
    ).jsonOutput;

    expect(output?.message).to.match(/version 9/);
  });

  it('errors when the scorer file is not found', () => {
    const output = execCmd<AgentScorerEditResult>(
      `agent scorer edit --api-name Missing_Scorer --version 1 --status Available --output-dir "${outputDir}" --json`,
      { ensureExitCode: 1 }
    ).jsonOutput;

    expect(output?.message).to.include('was found at');
  });
});
