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
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import { ensureYamlExtension } from '../../../../src/commands/agent/generate/scorer-spec.js';

describe('AgentGenerateScorerSpec', () => {
  describe('ensureYamlExtension', () => {
    it('leaves a .yaml path unchanged', () => {
      expect(ensureYamlExtension('specs/my_scorer.yaml')).to.equal('specs/my_scorer.yaml');
    });

    it('leaves a .yml path unchanged', () => {
      expect(ensureYamlExtension('specs/my_scorer.yml')).to.equal('specs/my_scorer.yml');
    });

    it('appends .yaml when extension is missing', () => {
      expect(ensureYamlExtension('specs/my_scorer')).to.equal(join('specs', 'my_scorer.yaml'));
    });

    it('replaces a non-yaml extension with .yaml', () => {
      expect(ensureYamlExtension('specs/my_scorer.txt')).to.equal(join('specs', 'my_scorer.yaml'));
    });
  });

  describe('run', () => {
    const $$ = new TestContext();
    let writeScorerSpecTemplateStub: sinon.SinonStub;
    let AgentGenerateScorerSpec: any;

    beforeEach(async () => {
      writeScorerSpecTemplateStub = $$.SANDBOX.stub().resolves();

      const mod = await esmock('../../../../src/commands/agent/generate/scorer-spec.js', {
        '@salesforce/agents': {
          AgentScorer: {
            writeScorerSpecTemplate: writeScorerSpecTemplateStub,
            defaultSpecPath: (name: string) => join('specs', `${name}-scorerSpec.yaml`),
          },
        },
      });
      AgentGenerateScorerSpec = mod.default;
    });

    afterEach(() => {
      $$.restore();
    });

    it('writes Number template to default path when no flags provided', async () => {
      await AgentGenerateScorerSpec.run(['--force-overwrite']);

      expect(writeScorerSpecTemplateStub.calledOnce).to.be.true;
      const [outputFile, dataType, overrides] = writeScorerSpecTemplateStub.firstCall.args;
      expect(outputFile).to.equal(join('specs', 'My_Custom_Scorer-scorerSpec.yaml'));
      expect(dataType).to.equal('Number');
      expect(overrides).to.deep.equal({ name: undefined, agentApiName: undefined });
    });

    it('passes --name to writeScorerSpecTemplate and uses it in default path', async () => {
      await AgentGenerateScorerSpec.run(['--force-overwrite', '--name', 'Sentiment_Scorer']);

      const [outputFile, , overrides] = writeScorerSpecTemplateStub.firstCall.args;
      expect(outputFile).to.equal(join('specs', 'Sentiment_Scorer-scorerSpec.yaml'));
      expect(overrides.name).to.equal('Sentiment_Scorer');
    });

    it('passes --agent-api-name to writeScorerSpecTemplate', async () => {
      await AgentGenerateScorerSpec.run(['--force-overwrite', '--agent-api-name', 'Resort_Agent']);

      const [, , overrides] = writeScorerSpecTemplateStub.firstCall.args;
      expect(overrides.agentApiName).to.equal('Resort_Agent');
    });

    it('passes --data-type Text to writeScorerSpecTemplate', async () => {
      await AgentGenerateScorerSpec.run(['--force-overwrite', '--data-type', 'Text']);

      const [, dataType] = writeScorerSpecTemplateStub.firstCall.args;
      expect(dataType).to.equal('Text');
    });

    it('uses --output-file when provided instead of default path', async () => {
      await AgentGenerateScorerSpec.run(['--force-overwrite', '--output-file', 'custom/path.yaml']);

      const [outputFile] = writeScorerSpecTemplateStub.firstCall.args;
      expect(outputFile).to.equal('custom/path.yaml');
    });

    it('passes all flags together correctly', async () => {
      await AgentGenerateScorerSpec.run([
        '--force-overwrite',
        '--name',
        'Language_Classifier',
        '--agent-api-name',
        'My_Agent',
        '--data-type',
        'Text',
      ]);

      const [outputFile, dataType, overrides] = writeScorerSpecTemplateStub.firstCall.args;
      expect(outputFile).to.equal(join('specs', 'Language_Classifier-scorerSpec.yaml'));
      expect(dataType).to.equal('Text');
      expect(overrides).to.deep.equal({ name: 'Language_Classifier', agentApiName: 'My_Agent' });
    });
  });
});
