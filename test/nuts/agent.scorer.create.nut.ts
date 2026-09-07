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
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { expect } from 'chai';
import { TestSession, execCmd } from '@salesforce/cli-plugins-testkit';
import { parseScorerVersions } from '@salesforce/agents';
import type { AgentScorerCreateResult } from '../../src/commands/agent/scorer/create.js';

// `agent scorer create` writes local metadata only, but its `--target-org` is a required flag that resolves at
// parse time, so this NUT needs a default org. It uses a lightweight scratch org (devhub only — no Einstein
// provisioning or metadata deploy, which create doesn't need) rather than the shared heavyweight session.
describe('agent scorer create NUTs', function () {
  this.timeout(15 * 60 * 1000);

  const API_NAME = 'Nut_Create_Scorer';
  // A `Manual`-engine scorer needs no prompt template, so create writes a single self-contained definition file.
  const makeSpec = (apiName: string, label: string): Record<string, unknown> => ({
    apiName,
    lightningType: 'lightning__textType',
    inputScope: 'Session',
    label,
    engineType: 'Manual',
    status: 'Draft',
    agentAssociation: { agentApiName: 'My_Agent', isActive: false },
  });

  let session: TestSession;
  let outputDir: string;
  let specPath: string;
  let scorerPath: string;

  before(async () => {
    session = await TestSession.create({
      project: { name: 'scorerCreateNut' },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [{ setDefault: true, config: join('config', 'project-scratch-def.json') }],
    });
    outputDir = join(session.project.dir, 'scorer-out');
    specPath = join(session.project.dir, 'nut-create-spec.json');
    scorerPath = join(outputDir, 'aiAgentScorerDefinitions', `${API_NAME}.aiAgentScorerDefinition-meta.xml`);
    writeFileSync(specPath, JSON.stringify(makeSpec(API_NAME, 'NUT Create Scorer')));
  });

  after(async () => {
    await session?.clean();
  });

  it('prints the spec JSON Schema with --spec-schema', () => {
    const { stdout } = execCmd('agent scorer create --spec-schema', { ensureExitCode: 0 }).shellOutput;
    expect(stdout).to.include('ScorerSpec');
    expect(stdout).to.include('apiName');
  });

  it('authors a scorer definition from a --spec file', () => {
    const result = execCmd<AgentScorerCreateResult>(
      `agent scorer create --spec "${specPath}" --output-dir "${outputDir}" --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result?.apiName).to.equal(API_NAME);
    expect(result?.path).to.equal(scorerPath);
    expect(existsSync(scorerPath)).to.equal(true);
    expect(parseScorerVersions(readFileSync(scorerPath, 'utf8'))).to.have.length(1);
  });

  it('appends a new version with --new-version', () => {
    execCmd<AgentScorerCreateResult>(
      `agent scorer create --spec "${specPath}" --output-dir "${outputDir}" --new-version --json`,
      { ensureExitCode: 0 }
    );

    const versions = parseScorerVersions(readFileSync(scorerPath, 'utf8'));
    expect(versions.map((v) => v.versionNumber)).to.deep.equal([1, 2]);
  });

  it('refuses to overwrite an existing scorer without --new-version', () => {
    const output = execCmd<AgentScorerCreateResult>(
      `agent scorer create --spec "${specPath}" --output-dir "${outputDir}" --json`,
      { ensureExitCode: 1 }
    ).jsonOutput;

    expect(output?.message).to.match(new RegExp(API_NAME));
    // the existing file is left untouched (still two versions from the prior test)
    expect(parseScorerVersions(readFileSync(scorerPath, 'utf8'))).to.have.length(2);
  });

  it('writes nothing with --preview', () => {
    const previewName = 'Nut_Preview_Scorer';
    const previewSpec = join(session.project.dir, 'nut-preview-spec.json');
    writeFileSync(previewSpec, JSON.stringify(makeSpec(previewName, 'NUT Preview Scorer')));
    const previewPath = join(outputDir, 'aiAgentScorerDefinitions', `${previewName}.aiAgentScorerDefinition-meta.xml`);

    const result = execCmd<AgentScorerCreateResult>(
      `agent scorer create --spec "${previewSpec}" --output-dir "${outputDir}" --preview --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result?.contents).to.include('AiAgentScorerDefinition');
    expect(existsSync(previewPath)).to.equal(false);
  });
});
