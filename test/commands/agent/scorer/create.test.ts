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
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import YAML from 'yaml';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import type { ScorerSpecFile } from '../../../../src/commands/agent/scorer/create.js';

function makeTextSpec(overrides: Partial<ScorerSpecFile> = {}): ScorerSpecFile {
  return {
    apiName: 'Test_Scorer',
    dataType: 'Text',
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

function makeNumberSpec(overrides: Partial<ScorerSpecFile> = {}): ScorerSpecFile {
  return {
    apiName: 'Numeric_Scorer',
    dataType: 'Number',
    inputScope: 'Session',
    label: 'Numeric Scorer',
    engineType: 'Manual',
    status: 'Available',
    agentAssociation: {
      agentApiName: 'My_Agent',
      isActive: false,
    },
    specification: {
      valueSpecification: {
        min: 0,
        max: 5,
        step: 1,
      },
    },
    ...overrides,
  };
}

function makeOpenSpec(overrides: Partial<ScorerSpecFile> = {}): ScorerSpecFile {
  return {
    apiName: 'Open_Scorer',
    dataType: 'LightningType',
    scorerType: 'OpenEnded',
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

function makePromptTemplateSpec(overrides: Partial<ScorerSpecFile> = {}): ScorerSpecFile {
  return {
    apiName: 'Prompt_Scorer',
    dataType: 'Text',
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
  yamlSpec: ScorerSpecFile,
  opts?: { existsSync?: () => boolean; confirmResult?: boolean }
): Promise<{ Command: any; writtenFiles: WrittenFile[]; createdDirs: string[] }> {
  const yamlContent = YAML.stringify(yamlSpec);
  const writtenFiles: WrittenFile[] = [];
  const createdDirs: string[] = [];
  const fileExists = opts?.existsSync ?? (() => false);

  const fsMock: Record<string, any> = {
    readFileSync: () => yamlContent,
    writeFileSync: (path: string, content: string) => {
      writtenFiles.push({ path, content });
    },
    mkdirSync: (path: string) => {
      createdDirs.push(path);
    },
    existsSync: fileExists,
  };

  const mocks: Record<string, any> = { 'node:fs': fsMock };

  if (opts?.confirmResult !== undefined) {
    mocks['@inquirer/prompts'] = {
      confirm: sinon.stub().resolves(opts.confirmResult),
      select: sinon.stub().resolves('Text'),
      input: sinon.stub().resolves(''),
    };
  }

  const mod = await esmock('../../../../src/commands/agent/scorer/create.js', mocks);
  return { Command: mod.default, writtenFiles, createdDirs };
}

describe('agent scorer create', () => {
  const $$ = new TestContext();
  let testOrg: MockTestOrgData;

  before(async function () {
    // Warm up esmock to check it can load the module
    try {
      await esmock('../../../../src/commands/agent/scorer/create.js', {
        'node:fs': {
          readFileSync: () => '',
          writeFileSync: () => {},
          mkdirSync: () => {},
          existsSync: () => false,
        },
      });
    } catch (e: any) {
      console.error('esmock warmup failed:', e.message);
      this.skip();
    }
  });

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
    testOrg = new MockTestOrgData();
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('--spec flag (YAML-driven) with --preview', () => {
    it('should create a Text scorer from a YAML spec', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.apiName).to.equal('Test_Scorer');
      expect(result.contents).to.include('AiAgentScorerDefinition');
      expect(result.contents).to.include('<dataType>Text</dataType>');
      expect(result.contents).to.include('<inputScope>Session</inputScope>');
      expect(result.contents).to.include('<engineType>Manual</engineType>');
      expect(result.contents).to.include('<status>Draft</status>');
      expect(result.contents).to.include('<agentApiName>My_Agent</agentApiName>');
      expect(result.contents).to.include('<value>Positive</value>');
      expect(result.contents).to.include('<value>Negative</value>');
      expect(result.contents).to.include('<value>Neutral</value>');
    });

    it('should create a Number scorer with specification', async () => {
      const { Command } = await loadMockedCommand(makeNumberSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'numeric-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.apiName).to.equal('Numeric_Scorer');
      expect(result.contents).to.include('<dataType>Number</dataType>');
      expect(result.contents).to.include('<min>0</min>');
      expect(result.contents).to.include('<max>5</max>');
      expect(result.contents).to.include('<step>1</step>');
      expect(result.contents).to.include('<value>0</value>');
      expect(result.contents).to.include('<value>5</value>');
      expect(result.contents).to.include('<status>Available</status>');
    });

    it('should create a Number scorer with threshold', async () => {
      const spec = makeNumberSpec({
        specification: { valueSpecification: { min: 1, max: 10, step: 1, threshold: 7 } },
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'threshold-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<threshold>7</threshold>');
      expect(result.contents).to.include('<min>1</min>');
      expect(result.contents).to.include('<max>10</max>');
    });

    it('should create an OpenEnded (LightningType) scorer', async () => {
      const { Command } = await loadMockedCommand(makeOpenSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'open-scorer.yaml',
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
        '--target-org', testOrg.username,
        '--spec', 'open-scorer.yaml',
        '--preview',
        '--json',
      ]);

      const agentAssocBlock = result.contents.substring(
        result.contents.indexOf('<agentAssociation>'),
        result.contents.indexOf('</agentAssociation>') + '</agentAssociation>'.length
      );
      expect(agentAssocBlock).to.include('<inputScope>Intent</inputScope>');
    });

    it('should include outputEnumValues for OpenEnded scorer when provided', async () => {
      const spec = makeOpenSpec({
        outputEnumValues: [
          { value: 'GOOD', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'BAD', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
          { value: 'N/A', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false },
        ],
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'open-scorer.yaml',
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

    it('should not include outputEnumValue for OpenEnded scorer when none provided', async () => {
      const { Command } = await loadMockedCommand(makeOpenSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'open-scorer.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).not.to.include('<outputEnumValue>');
      expect(result.contents).not.to.include('<value>');
    });

    it('should generate prompt template path for PromptTemplate engine', async () => {
      const { Command } = await loadMockedCommand(makePromptTemplateSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'prompt-scorer.yaml',
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
      const { Command } = await loadMockedCommand(makeTextSpec({ engineType: 'Manual' }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'manual-scorer.yaml',
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
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
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
      const spec = makeTextSpec();
      spec.agentAssociation.inputScope = undefined;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
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

    it('should include semanticType when set', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec({ semanticType: 'Dimension' }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<semanticType>Dimension</semanticType>');
    });

    it('should include description when provided', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec({ description: 'Evaluates politeness' }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<description>Evaluates politeness</description>');
    });

    it('should omit description when not provided', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec({ description: undefined }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).not.to.include('<description>');
    });

    it('should default samplingRate to 1.0', async () => {
      const spec = makeTextSpec();
      spec.agentAssociation.samplingRate = undefined;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<samplingRate>1</samplingRate>');
    });

    it('should use custom samplingRate', async () => {
      const spec = makeTextSpec();
      spec.agentAssociation.samplingRate = 0.25;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<samplingRate>0.25</samplingRate>');
    });

    it('should set versionNumber to 1', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<versionNumber>1</versionNumber>');
    });
  });

  describe('prompt template type selection', () => {
    it('should use scorerOpenEnded type for OpenEnded scorerType', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeOpenSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('agentforce_session_tracing__scorerOpenEnded');
    });

    it('should use scorerMeasurement type for Measurement semanticType', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(
        makePromptTemplateSpec({ semanticType: 'Measurement' })
      );

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('agentforce_session_tracing__scorerMeasurement');
    });

    it('should use scorerMultilabel type for default Text scorers', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('agentforce_session_tracing__scorerMultilabel');
    });
  });

  describe('number enum value generation', () => {
    it('should generate correct values for integer steps', async () => {
      const spec = makeNumberSpec({
        specification: { valueSpecification: { min: 0, max: 3, step: 1 } },
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<value>0</value>');
      expect(result.contents).to.include('<value>1</value>');
      expect(result.contents).to.include('<value>2</value>');
      expect(result.contents).to.include('<value>3</value>');
    });

    it('should generate correct values for decimal steps', async () => {
      const spec = makeNumberSpec({
        specification: { valueSpecification: { min: 0, max: 1, step: 0.5 } },
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<value>0</value>');
      expect(result.contents).to.include('<value>0.5</value>');
      expect(result.contents).to.include('<value>1</value>');
    });

    it('should set outcomeType to NotApplicable for number values', async () => {
      const spec = makeNumberSpec({
        specification: { valueSpecification: { min: 1, max: 2, step: 1 } },
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      const matches = result.contents.match(/<outcomeType>NotApplicable<\/outcomeType>/g);
      expect(matches).to.have.length(2);
    });

    it('should handle large step generating few values', async () => {
      const spec = makeNumberSpec({
        specification: { valueSpecification: { min: 0, max: 100, step: 50 } },
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<value>0</value>');
      expect(result.contents).to.include('<value>50</value>');
      expect(result.contents).to.include('<value>100</value>');
    });
  });

  describe('XML structure', () => {
    it('should include XML declaration and namespace', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.contents).to.include('xmlns="http://soap.sforce.com/2006/04/metadata"');
    });

    it('should include isActive in agent association', async () => {
      const spec = makeTextSpec();
      spec.agentAssociation.isActive = true;
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<isActive>true</isActive>');
    });

    it('should include isFallback and isSystemFallback', async () => {
      const spec = makeTextSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: true, isSystemFallback: false },
        ],
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<isFallback>false</isFallback>');
      expect(result.contents).to.include('<isFallback>true</isFallback>');
      expect(result.contents).to.include('<isSystemFallback>false</isSystemFallback>');
    });

    it('should include label in scorerVersion', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec({ label: 'My Custom Label' }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<label>My Custom Label</label>');
    });
  });

  describe('file writing', () => {
    it('should write scorer XML to correct path', async () => {
      const { Command, writtenFiles, createdDirs } = await loadMockedCommand(makeTextSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
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
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
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
      const { Command, writtenFiles } = await loadMockedCommand(makeTextSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(writtenFiles).to.have.length(0);
    });

    it('should use default prompt content when promptContent not in spec', async () => {
      const spec = makePromptTemplateSpec();
      delete (spec as any).promptContent;
      const { Command, writtenFiles } = await loadMockedCommand(spec);

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('{!$Input:Session}');
      expect(promptFile!.content).to.include('{!$Input:AllowedLabels}');
      expect(promptFile!.content).to.include('{!$Input:FallbackLabel}');
    });

    it('should use OpenEnded default prompt for OpenEnded type', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeOpenSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('{!$Input:Session}');
      expect(promptFile!.content).not.to.include('{!$Input:AllowedLabels}');
    });
  });

  describe('output directory', () => {
    it('should default to force-app/main/default', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.path).to.include('force-app/main/default/aiAgentScorerDefinitions');
    });

    it('should use custom --output-dir', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec());

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/custom/path',
        '--preview',
        '--json',
      ]);

      expect(result.path).to.include('/custom/path/aiAgentScorerDefinitions');
    });
  });

  describe('overwrite behavior', () => {
    it('should cancel when user declines overwrite', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeTextSpec(), {
        existsSync: () => true,
        confirmResult: false,
      });

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
      ]);

      expect(result.path).to.equal('');
      expect(result.contents).to.equal('');
      expect(writtenFiles).to.have.length(0);
    });

    it('should skip overwrite prompt in --json mode', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makeTextSpec(), {
        existsSync: () => true,
      });

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      expect(result.path).to.not.equal('');
      expect(writtenFiles).to.have.length(1);
    });
  });

  describe('prompt template XML details', () => {
    it('should include developerName and masterLabel matching apiName', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(
        makePromptTemplateSpec({ apiName: 'My_Prompt_Scorer' })
      );

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<developerName>My_Prompt_Scorer</developerName>');
      expect(promptFile!.content).to.include('<masterLabel>My_Prompt_Scorer</masterLabel>');
    });

    it('should set overridable to false and visibility to Global', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<overridable>false</overridable>');
      expect(promptFile!.content).to.include('<visibility>Global</visibility>');
    });

    it('should set primaryModel and status Published', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
        '--json',
      ]);

      const promptFile = writtenFiles.find((f) => f.path.includes('genAiPromptTemplates'));
      expect(promptFile!.content).to.include('<primaryModel>sfdc_ai__DefaultOpenAIGPT4OmniMini</primaryModel>');
      expect(promptFile!.content).to.include('<status>Published</status>');
    });

    it('should include Session input with correct definition', async () => {
      const { Command, writtenFiles } = await loadMockedCommand(makePromptTemplateSpec());

      await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--output-dir', '/tmp/out',
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
      const { Command } = await loadMockedCommand(makeTextSpec());

      try {
        await Command.run(['--target-org', testOrg.username, '--json']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('Missing required flags');
      }
    });

    it('should list all missing required flags', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec());

      try {
        await Command.run(['--target-org', testOrg.username, '--label', 'Foo', '--json']);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('api-name');
        expect(error.message).to.include('data-type');
        expect(error.message).to.include('engine-type');
        expect(error.message).to.include('agent-api-name');
      }
    });
  });

  describe('Text scorer fallback validation', () => {
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

    it('should throw when Text scorer has no fallback value', async () => {
      const spec = makeTextSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
        ],
      });
      writeFileSync(specFile, YAML.stringify(spec));
      const { Command } = await loadMockedCommand(spec);

      try {
        await Command.run([
          '--target-org', testOrg.username,
          '--spec', specFile,
          '--preview',
          '--json',
        ]);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('exactly 1 fallback value');
        expect(error.message).to.include('found 0');
      }
    });

    it('should throw when Text scorer has multiple fallback values', async () => {
      const spec = makeTextSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: true, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: true, isSystemFallback: false },
        ],
      });
      writeFileSync(specFile, YAML.stringify(spec));
      const { Command } = await loadMockedCommand(spec);

      try {
        await Command.run([
          '--target-org', testOrg.username,
          '--spec', specFile,
          '--preview',
          '--json',
        ]);
        expect.fail('should have thrown');
      } catch (err: unknown) {
        const error = err as { message: string };
        expect(error.message).to.include('exactly 1 fallback value');
        expect(error.message).to.include('found 2');
      }
    });

    it('should pass when Text scorer has exactly 1 fallback value', async () => {
      const spec = makeTextSpec({
        outputEnumValues: [
          { value: 'Good', outcomeType: 'Pass', isFallback: false, isSystemFallback: false },
          { value: 'Bad', outcomeType: 'Fail', isFallback: false, isSystemFallback: false },
          { value: 'N/A', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false },
        ],
      });
      writeFileSync(specFile, YAML.stringify(spec));
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', specFile,
        '--preview',
        '--json',
      ]);

      expect(result.apiName).to.equal('Test_Scorer');
      expect(result.contents).to.include('<value>N/A</value>');
    });
  });

  describe('edge cases', () => {
    it('should handle LightningType with no outputEnumValues', async () => {
      const spec: ScorerSpecFile = {
        apiName: 'Lightning_Scorer',
        dataType: 'LightningType',
        scorerType: 'OpenEnded',
        lightningType: 'lightning__numberType',
        inputScope: 'Session',
        label: 'Lightning Scorer',
        engineType: 'Manual',
        agentAssociation: { agentApiName: 'Agent_X', isActive: false },
      };
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<dataType>LightningType</dataType>');
      expect(result.contents).to.include('<lightningType>lightning__numberType</lightningType>');
    });

    it('should handle single output enum value', async () => {
      const spec = makeTextSpec({
        outputEnumValues: [
          { value: 'Only', outcomeType: 'NotApplicable', isFallback: true, isSystemFallback: false },
        ],
      });
      const { Command } = await loadMockedCommand(spec);

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<value>Only</value>');
      expect(result.contents).to.include('<outcomeType>NotApplicable</outcomeType>');
      expect(result.contents).to.include('<isFallback>true</isFallback>');
    });

    it('should include scorerType Predefined when set', async () => {
      const { Command } = await loadMockedCommand(makeTextSpec({ scorerType: 'Predefined' }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<scorerType>Predefined</scorerType>');
    });

    it('should include Measurement semanticType in XML', async () => {
      const { Command } = await loadMockedCommand(makeNumberSpec({ semanticType: 'Measurement' }));

      const result = await Command.run([
        '--target-org', testOrg.username,
        '--spec', 'test.yaml',
        '--preview',
        '--json',
      ]);

      expect(result.contents).to.include('<semanticType>Measurement</semanticType>');
    });
  });
});
