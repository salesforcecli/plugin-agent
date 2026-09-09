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

import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';

// The command reads specs via node:fs, but createScorerDefinition (in @salesforce/agents) writes
// output via node:fs/promises (writeFile/mkdir). node: core modules are singletons, so stubbing
// this shared instance captures the library's real writes without touching disk. Obtained through
// createRequire because ESM namespace objects are frozen and cannot be stubbed.
const fsPromises = createRequire(import.meta.url)('node:fs/promises') as {
  writeFile: (...args: any[]) => Promise<void>;
  mkdir: (...args: any[]) => Promise<unknown>;
  readFile: (...args: any[]) => Promise<string | Buffer>;
};
import YAML from 'yaml';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import * as agentsModule from '@salesforce/agents';
import type { ScorerSpec } from '@salesforce/agents';

function makeLabeledSpec(overrides: Partial<ScorerSpec> = {}): ScorerSpec {
  return {
    apiName: 'Test_Scorer',
    lightningType: 'lightning__textType',
    inputScope: 'Session',
    label: 'Test Scorer',
    description: 'A test scorer',
    engineType: 'Manual',
    status: 'Draft',
    agentAssociation: {
      agentApiName: 'My_Agent',
      isActive: false,
    },
    outputEnumValues: [
      { value: 'Positive', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
      { value: 'Negative', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
      { value: 'Neutral', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false },
    ],
    ...overrides,
  };
}

function makeOpenSpec(overrides: Partial<ScorerSpec> = {}): ScorerSpec {
  return {
    apiName: 'Open_Scorer',
    lightningType: 'lightning__textType',
    inputScope: 'Session',
    label: 'Open Scorer',
    engineType: 'PromptTemplate',
    status: 'Draft',
    agentAssociation: {
      agentApiName: 'My_Agent',
      isActive: true,
      samplingRate: 0.5,
      inputScope: 'Intent',
    },
    ...overrides,
  };
}

function makePromptTemplateSpec(overrides: Partial<ScorerSpec> = {}): ScorerSpec {
  return {
    apiName: 'Prompt_Scorer',
    lightningType: 'lightning__textType',
    inputScope: 'Session',
    label: 'Prompt Scorer',
    engineType: 'PromptTemplate',
    status: 'Draft',
    promptContent: 'Evaluate this session.\n\n{!$Input:Session}',
    agentAssociation: {
      agentApiName: 'My_Agent',
      isActive: true,
      samplingRate: 1.0,
    },
    outputEnumValues: [
      { value: 'Pass', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
      { value: 'Fail', outcomeType: 'Fail', isFallback: true, isSystemFallback: false },
    ],
    ...overrides,
  };
}

type WrittenFile = { path: string; content: string };

async function loadMockedCommand(
  yamlSpec: ScorerSpec,
  opts?: {
    existsSync?: () => boolean;
    confirmResult?: boolean;
  }
): Promise<{ Command: any; writtenFiles: WrittenFile[]; createdDirs: string[] }> {
  const yamlContent = YAML.stringify(yamlSpec);
  const writtenFiles: WrittenFile[] = [];
  const createdDirs: string[] = [];
  const fileExists = opts?.existsSync ?? (() => false);

  const fsMock: Record<string, any> = {
    readFileSync: () => yamlContent,
    existsSync: fileExists,
  };

  const mocks: Record<string, any> = { 'node:fs': fsMock };

  // Capture the scorer/prompt-template files written by createScorerDefinition (via
  // node:fs/promises) without hitting disk; delegate any unrelated writes to the real fns.
  const isScorerOutput = (p: unknown): boolean =>
    typeof p === 'string' && (p.includes('aiAgentScorerDefinitions') || p.includes('genAiPromptTemplates'));
  const origWriteFile = fsPromises.writeFile;
  const origMkdir = fsPromises.mkdir;

  sinon.stub(fsPromises, 'writeFile').callsFake((path: unknown, content: unknown, options: unknown) => {
    if (isScorerOutput(path)) {
      writtenFiles.push({ path: String(path), content: String(content) });
      return Promise.resolve();
    }
    return origWriteFile(path, content, options);
  });
  sinon.stub(fsPromises, 'mkdir').callsFake((path: unknown, options: unknown) => {
    if (isScorerOutput(path)) {
      createdDirs.push(String(path));
      return Promise.resolve(undefined);
    }
    return origMkdir(path, options);
  });

  if (opts?.confirmResult !== undefined) {
    mocks['@inquirer/prompts'] = {
      confirm: sinon.stub().resolves(opts.confirmResult),
      select: sinon.stub().resolves('lightning__textType'),
      input: sinon.stub().resolves(''),
    };
  }

  const mod = await esmock('../../../../src/commands/agent/scorer/generate-metadata-file.js', mocks);
  return { Command: mod.default, writtenFiles, createdDirs };
}

// Bare spec filenames used across the --spec tests. `spec: Flags.file({ exists: true })` makes
// oclif stat the path at parse time (via a CJS require of node:fs/promises deep inside
// @oclif/core, which esmock cannot intercept), so these must physically exist on disk. We create
// them in a temp dir and chdir there; the command's readFileSync is still mocked, so file
// contents are irrelevant — only their existence matters.
const SPEC_FILENAMES = [
  'test.yaml',
  'test-scorer.yaml',
  'open-scorer.yaml',
  'prompt-scorer.yaml',
  'manual-scorer.yaml',
];

describe('agent scorer generate-metadata-file', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;
  let originalCwd: string;
  let specDir: string;
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  before(async function () {
    // Warm up esmock to check it can load the module
    try {
      await esmock('../../../../src/commands/agent/scorer/generate-metadata-file.js', {
        'node:fs': {
          readFileSync: () => '',
          writeFileSync: () => {},
          mkdirSync: () => {},
          existsSync: () => false,
        },
      });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('esmock warmup failed:', e.message);
      this.skip();
    }

    originalCwd = process.cwd();
    specDir = mkdtempSync(join(tmpdir(), 'scorer-specs-'));
    for (const name of SPEC_FILENAMES) writeFileSync(join(specDir, name), '');
    process.chdir(specDir);
  });

  after(() => {
    if (originalCwd) process.chdir(originalCwd);
    if (specDir) rmSync(specDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
    sinon.restore();
  });

  describe('--spec flag (YAML-driven) with --preview', () => {
    it('should create a labeled scorer from a YAML spec', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.apiName).to.equal('Test_Scorer');
      expect(result.contents).to.include('AiAgentScorerDefinition');
      expect(result.contents).to.include('<dataType>LightningType</dataType>');
      expect(result.contents).to.include('<lightningType>lightning__textType</lightningType>');
      expect(result.contents).to.include('<scorerType>OpenEnded</scorerType>');
      expect(result.contents).to.include('<inputScope>Session</inputScope>');
      expect(result.contents).to.include('<engineType>Manual</engineType>');
      expect(result.contents).to.include('<status>Draft</status>');
      expect(result.contents).to.include('<agentApiName>My_Agent</agentApiName>');
      expect(result.contents).to.include('<value>Positive</value>');
      expect(result.contents).to.include('<value>Negative</value>');
      expect(result.contents).to.include('<value>Neutral</value>');
    });

    it('should create an OpenEnded (LightningType) scorer', async () => {
      const { Command } = await loadMockedCommand(makeOpenSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'open-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.apiName).to.equal('Open_Scorer');
      expect(result.contents).to.include('<dataType>LightningType</dataType>');
      expect(result.contents).to.include('<lightningType>lightning__textType</lightningType>');
      expect(result.contents).to.include('<scorerType>OpenEnded</scorerType>');
      expect(result.contents).to.include('<inputScope>Session</inputScope>');
    });

    it('should include inputScope in agent association when specified', async () => {
      const { Command } = await loadMockedCommand(makeOpenSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'open-scorer.yaml',
        '--preview',
        '--json',
      ]);

      const agentAssocBlock = result.contents.substring(
        result.contents.indexOf('<agentAssociation>'),
        result.contents.indexOf('</agentAssociation>') + '</agentAssociation>'.length
      );
      expect(agentAssocBlock).to.include('<inputScope>Intent</inputScope>');
    });

    it('should include outputEnumValues when provided', async () => {
      const spec = makeOpenSpec({
        outputEnumValues: [
          { value: 'GOOD', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'BAD', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
          { value: 'N/A', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false },
        ],
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'open-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<dataType>LightningType</dataType>');
      expect(result.contents).to.include('<scorerType>OpenEnded</scorerType>');
      expect(result.contents).to.include('<value>GOOD</value>');
      expect(result.contents).to.include('<value>BAD</value>');
      expect(result.contents).to.include('<value>N/A</value>');
      expect(result.contents).to.include('<outcomeType>Pass</outcomeType>');
      expect(result.contents).to.include('<outcomeType>Fail</outcomeType>');
      expect(result.contents).to.include('<outcomeType>NotApplicable</outcomeType>');
      expect(result.contents).to.include('<isFallback>true</isFallback>');
    });

    it('should not include outputEnumValue when none provided', async () => {
      const { Command } = await loadMockedCommand(makeOpenSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'open-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).not.to.include('<outputEnumValue>');
      expect(result.contents).not.to.include('<value>');
    });

    it('should generate prompt template path for PromptTemplate engine', async () => {
      const { Command } = await loadMockedCommand(makePromptTemplateSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'prompt-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.promptTemplatePath).to.be.a('string');
      expect(result.promptTemplatePath).to.include('genAiPromptTemplates');
      expect(result.promptTemplatePath).to.include('Prompt_Scorer.genAiPromptTemplate-meta.xml');
      expect(result.contents).to.include('<engineRef>Prompt_Scorer</engineRef>');
      expect(result.contents).to.include('<engineType>PromptTemplate</engineType>');
    });

    it('should not generate prompt template for Manual engine', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec({ engineType: 'Manual' }));

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'manual-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.promptTemplatePath).to.be.undefined;
      expect(result.contents).not.to.include('<engineRef>');
      expect(result.contents).to.include('<engineType>Manual</engineType>');
    });

    it('should use promptTemplateName as engineRef and skip prompt template file generation', async () => {
      const spec = makePromptTemplateSpec({ promptTemplateName: 'My_Existing_Template' });
      const { Command, writtenFiles } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      expect(result.contents).to.include('<engineRef>My_Existing_Template</engineRef>');
      expect(result.contents).to.include('<engineType>PromptTemplate</engineType>');
      expect(result.promptTemplatePath).to.be.undefined;
      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile).to.be.undefined;
      expect(writtenFiles).to.have.length(1);
    });

    it('should omit inputScope from agent association XML when not specified', async () => {
      const spec = makeLabeledSpec();
      spec.agentAssociation.inputScope = undefined;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      const agentAssocBlock = result.contents.substring(
        result.contents.indexOf('<agentAssociation>'),
        result.contents.indexOf('</agentAssociation>') + '</agentAssociation>'.length
      );
      expect(agentAssocBlock).to.include('<agentApiName>My_Agent</agentApiName>');
      expect(agentAssocBlock).not.to.include('<inputScope>');
    });

    it('should include description when provided', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec({ description: 'Evaluates politeness' }));

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<description>Evaluates politeness</description>');
    });

    it('should omit description when not provided', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec({ description: undefined }));

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).not.to.include('<description>');
    });

    it('should default samplingRate to 1.0', async () => {
      const spec = makeLabeledSpec();
      spec.agentAssociation.samplingRate = undefined;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<samplingRate>1</samplingRate>');
    });

    it('should use custom samplingRate', async () => {
      const spec = makeLabeledSpec();
      spec.agentAssociation.samplingRate = 0.25;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<samplingRate>0.25</samplingRate>');
    });

    it('should set versionNumber to 1', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<versionNumber>1</versionNumber>');
    });
  });

  describe('prompt template type', () => {
    it('should always use scorerOpenEnded type', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeOpenSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('agentforce_session_tracing__scorerOpenEnded');
    });

    it('should use scorerOpenEnded type even when labels are defined', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('agentforce_session_tracing__scorerOpenEnded');
      expect(promptFile!.content).to.include('<apiName>AllowedLabels</apiName>');
      expect(promptFile!.content).to.include('<apiName>FallbackLabel</apiName>');
    });
  });

  describe('XML structure', () => {
    it('should include XML declaration and namespace', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.contents).to.include('xmlns="http://soap.sforce.com/2006/04/metadata"');
    });

    it('should include isActive in agent association', async () => {
      const spec = makeLabeledSpec();
      spec.agentAssociation.isActive = true;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<isActive>true</isActive>');
    });

    it('should include isFallback and isSystemFallback', async () => {
      const spec = makeLabeledSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: true, isSystemFallback: false },
        ],
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<isFallback>false</isFallback>');
      expect(result.contents).to.include('<isFallback>true</isFallback>');
      expect(result.contents).to.include('<isSystemFallback>false</isSystemFallback>');
    });

    it('should include label in scorerVersion', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec({ label: 'My Custom Label' }));

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<label>My Custom Label</label>');
    });
  });

  describe('file writing', () => {
    it('should write scorer XML to correct path', async () => {
      const { Command, writtenFiles, createdDirs } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      expect(result.path).to.include('/tmp/out');
      expect(result.path).to.include('aiAgentScorerDefinitions');
      expect(result.path).to.include('Test_Scorer.aiAgentScorerDefinition-meta.xml');
      expect(writtenFiles).to.have.length(1);
      expect(writtenFiles[0].content).to.include('AiAgentScorerDefinition');
      expect(createdDirs.some((d) => d.includes('aiAgentScorerDefinitions'))).to.be.true;
    });

    it('should write both scorer and prompt template for PromptTemplate', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      expect(writtenFiles).to.have.length(2);
      const scorerFile = writtenFiles.find((f) => f.path.includes('aiAgentScorerDefinitions'));
      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(scorerFile).to.not.be.undefined;
      expect(promptFile).to.not.be.undefined;
      expect(promptFile!.path).to.include('Prompt_Scorer.genAiPromptTemplate-meta.xml');
      expect(promptFile!.content).to.include('GenAiPromptTemplate');
      expect(result.promptTemplatePath).to.equal(promptFile!.path);
    });

    it('should not write files with --preview', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeLabeledSpec());

      await Command.run(['--target-org', testOrg.username, '--spec', 'test.yaml', '--preview', '--json']);

      expect(writtenFiles).to.have.length(0);
    });

    it('should use default prompt content when promptContent not in spec', async () => {
      const spec = makePromptTemplateSpec();
      delete (spec as any).promptContent;
      const { Command, writtenFiles } = await loadMockedCommand(spec);

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('{!$Input:Session}');
      expect(promptFile!.content).to.include('{!$Input:AllowedLabels}');
      expect(promptFile!.content).to.include('{!$Input:FallbackLabel}');
    });

    it('should omit label guidance from default prompt when no labels are defined', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeOpenSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('{!$Input:Session}');
      expect(promptFile!.content).not.to.include('{!$Input:AllowedLabels}');
    });
  });

  describe('output directory', () => {
    it('should default to force-app/main/default', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.path).to.include('force-app/main/default/aiAgentScorerDefinitions');
    });

    it('should use custom --output-dir', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/custom/path',
        '--preview',
        '--json',
      ]);

      expect(result.path).to.include('/custom/path/aiAgentScorerDefinitions');
    });
  });

  describe('existing scorer behavior', () => {
    // `create` is a one-shot scaffolder: once the XML exists it is the source of truth, so a re-run must not
    // overwrite it or silently mutate it. It errors and points the user at editing the metadata XML directly.
    it('errors and writes nothing when the scorer already exists', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeLabeledSpec(), {
        existsSync: () => true,
      });

      try {
        await Command.run([
          '--target-org',
          testOrg.username,
          '--spec',
          'test.yaml',
          '--output-dir',
          '/tmp/out',
          '--json',
        ]);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('already exists');
        // Directs the user to hand-edit the metadata XML rather than re-scaffolding via the CLI.
        expect((err as Error).message).to.include('metadata XML');
      }
      expect(writtenFiles).to.have.length(0);
    });

    // `this.log` is suppressed under --json, so an agent caller only sees the returned payload. The
    // scaffold-once guidance rides along in `result.guidance` so it still reaches that caller.
    it('returns scaffold-once guidance in the --json result on a fresh create', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      expect(result.guidance).to.be.a('string');
      expect(result.guidance).to.include('source of truth');
    });
  });

  describe('prompt template XML details', () => {
    it('should include developerName and masterLabel matching apiName', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(
        makePromptTemplateSpec({ apiName: 'My_Prompt_Scorer' })
      );

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<developerName>My_Prompt_Scorer</developerName>');
      expect(promptFile!.content).to.include('<masterLabel>My_Prompt_Scorer</masterLabel>');
    });

    it('should set overridable to false and visibility to Global', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<overridable>false</overridable>');
      expect(promptFile!.content).to.include('<visibility>Global</visibility>');
    });

    it('should set primaryModel and status Published', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<primaryModel>sfdc_ai__DefaultOpenAIGPT4OmniMini</primaryModel>');
      expect(promptFile!.content).to.include('<status>Published</status>');
    });

    it('should include activeVersionIdentifier and versionIdentifier', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<activeVersionIdentifier>');
      expect(promptFile!.content).to.include('<versionIdentifier>');
      // Both should have the same value
      const activeMatch = promptFile!.content.match(/<activeVersionIdentifier>(.+?)<\/activeVersionIdentifier>/);
      const versionMatch = promptFile!.content.match(/<versionIdentifier>(.+?)<\/versionIdentifier>/);
      expect(activeMatch![1]).to.equal(versionMatch![1]);
      expect(activeMatch![1]).to.match(/.+=_1$/);
    });

    it('should include Session input with correct definition', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--output-dir',
        '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include(
        'lightningtype://propertyType/agentforce_session_tracing__stdmDetailViewType'
      );
      expect(promptFile!.content).to.include('<referenceName>Input:Session</referenceName>');
    });
  });

  describe('--json mode error handling', () => {
    it('should throw when required flags are missing', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      try {
        await Command.run(['--target-org', testOrg.username, '--json']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('Missing required flags');
      }
    });

    it('should list all missing required flags', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      try {
        await Command.run(['--target-org', testOrg.username, '--label', 'Foo', '--json']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('api-name');
        expect(error.message).to.include('lightning-type');
        expect(error.message).to.include('engine-type');
        expect(error.message).to.include('agent-api-name');
      }
    });
  });

  describe('output label validation', () => {
    let tmpDir: string;
    let specFile: string;

    beforeEach(() => {
      tmpDir = join(process.cwd(), 'tmp-test-fallback-' + Date.now());
      mkdirSync(tmpDir, { recursive: true });
      specFile = join(tmpDir, 'scorer.yaml');
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should throw when more than one output value is the fallback', async () => {
      const spec = makeLabeledSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: true, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: true, isSystemFallback: false },
        ],
      });
      writeFileSync(specFile, YAML.stringify(spec));
      const { Command } = await loadMockedCommand(spec);

      try {
        await Command.run(['--target-org', testOrg.username, '--spec', specFile, '--preview', '--json']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('At most one outputEnumValue can be the fallback');
        expect(error.message).to.include('found 2');
      }
    });

    it('should pass with zero fallback values', async () => {
      const spec = makeLabeledSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
        ],
      });
      writeFileSync(specFile, YAML.stringify(spec));
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run(['--target-org', testOrg.username, '--spec', specFile, '--preview', '--json']);

      expect(result.apiName).to.equal('Test_Scorer');
      expect(result.contents).to.include('<value>Good</value>');
    });

    it('should pass with exactly one fallback value', async () => {
      const spec = makeLabeledSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
          { value: 'N/A', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false },
        ],
      });
      writeFileSync(specFile, YAML.stringify(spec));
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run(['--target-org', testOrg.username, '--spec', specFile, '--preview', '--json']);

      expect(result.apiName).to.equal('Test_Scorer');
      expect(result.contents).to.include('<value>N/A</value>');
    });
  });

  describe('edge cases', () => {
    it('should handle LightningType with no outputEnumValues', async () => {
      const spec: ScorerSpec = {
        apiName: 'Lightning_Scorer',
        lightningType: 'lightning__numberType',
        inputScope: 'Session',
        label: 'Lightning Scorer',
        engineType: 'Manual',
        agentAssociation: { agentApiName: 'Agent_X', isActive: false },
      };
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<dataType>LightningType</dataType>');
      expect(result.contents).to.include('<lightningType>lightning__numberType</lightningType>');
    });

    it('should handle single output enum value', async () => {
      const spec = makeLabeledSpec({
        outputEnumValues: [{ value: 'Only', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false }],
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--spec',
        'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<value>Only</value>');
      expect(result.contents).to.include('<outcomeType>NotApplicable</outcomeType>');
      expect(result.contents).to.include('<isFallback>true</isFallback>');
    });
  });

  describe('--json without --spec (flag-only path)', () => {
    it('completes without prompting when all required flags are supplied', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeLabeledSpec());

      const result = await Command.run([
        '--target-org',
        testOrg.username,
        '--label',
        'My Scorer',
        '--api-name',
        'My_Scorer',
        '--lightning-type',
        'lightning__textType',
        '--engine-type',
        'Manual',
        '--agent-api-name',
        'My_Agent',
        '--output-dir',
        '/tmp/out-json-flags',
        '--json',
      ]);

      expect(result.apiName).to.equal('My_Scorer');
      // The status flag's default ('Draft') must be honored without prompting.
      expect(result.contents).to.include('<status>Draft</status>');
      expect(writtenFiles).to.have.length(1);
    });
  });

  describe('--spec YAML parsing', () => {
    it('throws a clear error when the spec file is not valid YAML', async () => {
      const mod = await esmock('../../../../src/commands/agent/scorer/generate-metadata-file.js', {
        'node:fs': { readFileSync: () => 'foo: [1, 2', existsSync: () => false },
      });
      const Command = mod.default;

      try {
        await Command.run(['--target-org', testOrg.username, '--spec', 'test.yaml']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('Could not parse the --spec file as YAML');
      }
    });

    it('throws a clear error when the spec file is not a YAML object', async () => {
      const mod = await esmock('../../../../src/commands/agent/scorer/generate-metadata-file.js', {
        'node:fs': { readFileSync: () => '- 1\n- 2\n', existsSync: () => false },
      });
      const Command = mod.default;

      try {
        await Command.run(['--target-org', testOrg.username, '--spec', 'test.yaml']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('must define a YAML object');
      }
    });
  });

  describe('--spec-schema', () => {
    it('prints the schema JSON and skips org/spec resolution', async () => {
      const { Command } = await loadMockedCommand(makeLabeledSpec());

      // Deliberately omit --spec and every other required flag: --spec-schema must short-circuit
      // before the required-flags gate or spec/org resolution ever runs.
      const result = await Command.run(['--target-org', testOrg.username, '--spec-schema']);

      expect(result).to.deep.equal({ path: '', apiName: '', contents: '' });
      expect(sfCommandStubs.styledJSON.calledOnce).to.be.true;
      const printed = sfCommandStubs.styledJSON.firstCall.args[0] as Record<string, unknown>;
      expect(printed).to.have.property('$ref', '#/definitions/ScorerSpec');
      expect(printed).to.have.property('definitions');
    });
  });

  describe('interactive interview (no --spec, no --json)', () => {
    it('throws a clear error when the org has no agents to associate', async () => {
      const mocks: Record<string, unknown> = {
        'node:fs': { readFileSync: () => '', existsSync: () => false },
        '@inquirer/prompts': {
          input: sinon.stub().resolves(''),
          confirm: sinon.stub().resolves(false),
          select: sinon.stub().resolves(''),
        },
        '@salesforce/agents': {
          ...agentsModule,
          Agent: { listRemote: sinon.stub().resolves([]) },
        },
      };
      const mod = await esmock('../../../../src/commands/agent/scorer/generate-metadata-file.js', mocks);
      const Command = mod.default;

      try {
        // Supply every FLAGGABLE_PROMPTS-backed flag (including --description and --status, which
        // are otherwise resolved via promptForFlag() in ../../../flags.js — a module esmock does not
        // remock here, so any prompt routed through it would hit the real @inquirer/prompts and hang).
        await Command.run([
          '--target-org',
          testOrg.username,
          '--label',
          'My Scorer',
          '--api-name',
          'My_Scorer',
          '--lightning-type',
          'lightning__textType',
          '--engine-type',
          'Manual',
          '--description',
          'A test description',
          '--status',
          'Draft',
        ]);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('No agents found in the org');
      }
    });
  });
});
