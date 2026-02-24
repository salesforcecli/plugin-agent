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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, class-methods-use-this */

import { join } from 'node:path';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import { SfProject, generateApiName } from '@salesforce/core';
import type { AgentJobSpec } from '@salesforce/agents';

const MOCK_PROJECT_DIR = join(process.cwd(), 'test', 'mock-projects', 'agent-generate-template');

type CreateAuthoringBundleArgs = {
  bundleApiName: string;
  agentSpec: AgentJobSpec & { name: string; developerName: string };
  project: SfProject;
};

type PromptConfig = {
  message: string;
  choices?: Array<{ name: string; value: string; description?: string }>;
  validate?: (input: string) => boolean | string;
  default?: string;
};

describe('agent generate authoring-bundle', () => {
  const $$ = new TestContext();
  let selectStub: sinon.SinonStub;
  let inputStub: sinon.SinonStub;
  let createAuthoringBundleStub: sinon.SinonStub;
  let yesNoOrCancelStub: sinon.SinonStub;
  let AgentGenerateAuthoringBundle: any;

  beforeEach(async () => {
    selectStub = $$.SANDBOX.stub();
    inputStub = $$.SANDBOX.stub();
    createAuthoringBundleStub = $$.SANDBOX.stub().resolves();
    yesNoOrCancelStub = $$.SANDBOX.stub();

    // Use esmock to replace ESM module imports
    const mod = await esmock('../../../../src/commands/agent/generate/authoring-bundle.js', {
      '@inquirer/prompts': {
        select: selectStub,
        input: inputStub,
      },
      '@salesforce/agents': {
        ScriptAgent: {
          createAuthoringBundle: createAuthoringBundleStub,
        },
      },
      '../../../../src/yes-no-cancel.js': {
        default: yesNoOrCancelStub,
      },
    });

    AgentGenerateAuthoringBundle = mod.default;

    // Tell TestContext we're in a project context
    $$.inProject(true);

    const mockProject = {
      getPath: () => MOCK_PROJECT_DIR,
      getDefaultPackage: () => ({
        fullPath: join(MOCK_PROJECT_DIR, 'force-app'),
      }),
    } as unknown as SfProject;

    // Stub both resolve (used by framework) and getInstance (used by command code)
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('flag-based (non-interactive) usage', () => {
    it('should generate with --no-spec and --name and --api-name', async () => {
      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'My Agent',
        '--api-name',
        'MyAgent',
        '--target-org',
        'test@org.com',
      ]);

      expect(result.agentPath).to.include('MyAgent.agent');
      expect(result.metaXmlPath).to.include('MyAgent.bundle-meta.xml');
      expect(result.outputDir).to.include(join('aiAuthoringBundles', 'MyAgent'));
      expect(createAuthoringBundleStub.calledOnce).to.be.true;

      const callArgs = createAuthoringBundleStub.firstCall.args[0] as CreateAuthoringBundleArgs;
      expect(callArgs.bundleApiName).to.equal('MyAgent');
      expect(callArgs.agentSpec.name).to.equal('My Agent');
      expect(callArgs.agentSpec.developerName).to.equal('MyAgent');
      expect(callArgs.agentSpec.role).to.equal('My Agent description');
    });

    it('should generate with --spec pointing to a file', async () => {
      const specPath = join(MOCK_PROJECT_DIR, 'specs', 'agentSpec.yaml');

      const result = await AgentGenerateAuthoringBundle.run([
        '--spec',
        specPath,
        '--name',
        'Spec Agent',
        '--api-name',
        'SpecAgent',
        '--target-org',
        'test@org.com',
      ]);

      expect(result.agentPath).to.include('SpecAgent.agent');
      expect(createAuthoringBundleStub.calledOnce).to.be.true;

      const callArgs = createAuthoringBundleStub.firstCall.args[0] as CreateAuthoringBundleArgs;
      expect(callArgs.agentSpec.role).to.equal('test agent role');
      expect(callArgs.agentSpec.companyName).to.equal('Test Company Name');
    });

    it('should throw when --spec and --no-spec are both provided', async () => {
      try {
        await AgentGenerateAuthoringBundle.run([
          '--spec',
          'some/path.yaml',
          '--no-spec',
          '--name',
          'Agent',
          '--api-name',
          'Agent',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.include("can't specify both");
      }
    });

    it('should throw when --spec points to nonexistent file', async () => {
      try {
        await AgentGenerateAuthoringBundle.run([
          '--spec',
          '/nonexistent/path.yaml',
          '--name',
          'Agent',
          '--api-name',
          'Agent',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.include('No agent spec YAML file found');
      }
    });

    it('should auto-generate API name default from --name when --api-name is not provided', async () => {
      inputStub.resolves('MyCustomApiName');

      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'My Custom Agent',
        '--target-org',
        'test@org.com',
      ]);

      expect(inputStub.calledOnce).to.be.true;
      const inputCall = inputStub.firstCall.args[0] as PromptConfig;
      expect(inputCall.default).to.equal(generateApiName('My Custom Agent'));
      expect(result.outputDir).to.include('MyCustomApiName');
    });
  });

  describe('wizard (interactive) usage', () => {
    it('should prompt for spec type, name, and api name when no flags provided', async () => {
      selectStub.resolves('default');
      inputStub.onFirstCall().resolves('Interactive Agent');
      inputStub.onSecondCall().resolves('InteractiveAgent');

      const result = await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);

      expect(selectStub.calledOnce).to.be.true;
      expect(inputStub.calledTwice).to.be.true;
      expect(result.agentPath).to.include('InteractiveAgent.agent');

      const selectCall = selectStub.firstCall.args[0] as PromptConfig;
      expect(selectCall.message).to.equal('Select an authoring bundle template');

      const nameInputCall = inputStub.firstCall.args[0] as PromptConfig;
      expect(nameInputCall.message).to.equal('Enter the authoring bundle name');
    });

    it('should show spec file selection when "fromSpec" is chosen', async () => {
      selectStub.onFirstCall().resolves('fromSpec');
      selectStub.onSecondCall().resolves(join(MOCK_PROJECT_DIR, 'specs', 'agentSpec.yaml'));
      inputStub.onFirstCall().resolves('From Spec Agent');
      inputStub.onSecondCall().resolves('FromSpecAgent');

      const result = await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);

      expect(selectStub.calledTwice).to.be.true;
      expect(result.agentPath).to.include('FromSpecAgent.agent');

      const specFileCall = selectStub.secondCall.args[0] as PromptConfig;
      expect(specFileCall.message).to.equal('Select the agent spec YAML file');

      const callArgs = createAuthoringBundleStub.firstCall.args[0] as CreateAuthoringBundleArgs;
      expect(callArgs.agentSpec.role).to.equal('test agent role');
    });

    it('should only show default template when no spec files exist', async () => {
      // Override project path to a dir without specs/
      const noSpecsProject = {
        getPath: () => '/tmp/no-specs-here',
        getDefaultPackage: () => ({
          fullPath: join(MOCK_PROJECT_DIR, 'force-app'),
        }),
      } as unknown as SfProject;
      (SfProject.resolve as sinon.SinonStub).resolves(noSpecsProject);
      (SfProject.getInstance as sinon.SinonStub).returns(noSpecsProject);

      selectStub.resolves('default');
      inputStub.onFirstCall().resolves('No Spec Agent');
      inputStub.onSecondCall().resolves('NoSpecAgent');

      await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);

      const selectCall = selectStub.firstCall.args[0] as PromptConfig;
      expect(selectCall.choices).to.have.length(1);
      expect(selectCall.choices![0].value).to.equal('default');
    });

    it('should show both template options when spec files exist', async () => {
      selectStub.resolves('default');
      inputStub.onFirstCall().resolves('Agent');
      inputStub.onSecondCall().resolves('Agent');

      await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);

      const selectCall = selectStub.firstCall.args[0] as PromptConfig;
      expect(selectCall.choices).to.have.length(2);
      expect(selectCall.choices![0].value).to.equal('default');
      expect(selectCall.choices![0].name).to.equal('Default template (Recommended)');
      expect(selectCall.choices![1].value).to.equal('fromSpec');
      expect(selectCall.choices![1].name).to.equal('From an agent spec YAML file (Advanced)');
    });
  });

  describe('name validation', () => {
    let validate: (input: string) => boolean | string;

    beforeEach(async () => {
      selectStub.resolves('default');
      inputStub.onFirstCall().resolves('Valid Name');
      inputStub.onSecondCall().resolves('ValidName');
      await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);
      validate = (inputStub.firstCall.args[0] as PromptConfig).validate!;
    });

    it('should reject empty name', () => {
      expect(validate('')).to.equal('Authoring bundle name is required.');
    });

    it('should reject whitespace-only name', () => {
      expect(validate('   ')).to.equal("Authoring bundle name can't be empty.");
    });

    it('should accept valid name', () => {
      expect(validate('My Agent')).to.be.true;
    });
  });

  describe('API name validation', () => {
    let validate: (input: string) => boolean | string;

    beforeEach(async () => {
      selectStub.resolves('default');
      inputStub.onFirstCall().resolves('Agent');
      inputStub.onSecondCall().resolves('Agent');
      await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);
      validate = (inputStub.secondCall.args[0] as PromptConfig).validate!;
    });

    it('should reject API names over 80 characters', () => {
      expect(validate('A'.repeat(81))).to.equal('API name cannot be over 80 characters.');
    });

    it('should reject invalid API name characters', () => {
      expect(validate('invalid-name!')).to.equal('Invalid API name.');
    });

    it('should accept valid API names', () => {
      expect(validate('MyAgent01')).to.be.true;
      expect(validate('My_Agent_Name')).to.be.true;
    });

    it('should accept empty API name (uses default)', () => {
      expect(validate('')).to.be.true;
    });
  });

  describe('error handling', () => {
    it('should wrap errors from ScriptAgent.createAuthoringBundle', async () => {
      createAuthoringBundleStub.rejects(new Error('Generation failed'));

      try {
        await AgentGenerateAuthoringBundle.run([
          '--no-spec',
          '--name',
          'Agent',
          '--api-name',
          'Agent',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.include('Failed to generate authoring bundle');
        expect((error as Error).message).to.include('Generation failed');
        expect((error as Error).name).to.equal('AgentGenerationError');
      }
    });
  });

  describe('spec file filtering', () => {
    it('should filter out test spec files from the list', async () => {
      selectStub.onFirstCall().resolves('fromSpec');
      selectStub.onSecondCall().resolves(join(MOCK_PROJECT_DIR, 'specs', 'agentSpec.yaml'));
      inputStub.onFirstCall().resolves('Agent');
      inputStub.onSecondCall().resolves('Agent');

      await AgentGenerateAuthoringBundle.run(['--target-org', 'test@org.com']);

      const specFileCall = selectStub.secondCall.args[0] as PromptConfig;
      const choiceNames = specFileCall.choices!.map((c) => c.name);
      for (const name of choiceNames) {
        expect(name).to.not.include('-testSpec');
      }
    });
  });

  describe('duplicate bundle detection', () => {
    // Willie_Resort_Manager already exists in the mock project's aiAuthoringBundles directory
    const EXISTING_BUNDLE_API_NAME = 'Willie_Resort_Manager';

    it('should prompt when bundle with same API name already exists', async () => {
      yesNoOrCancelStub.resolves(true);

      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'Willie Resort Manager',
        '--api-name',
        EXISTING_BUNDLE_API_NAME,
        '--target-org',
        'test@org.com',
      ]);

      expect(yesNoOrCancelStub.calledOnce).to.be.true;
      const promptCall = yesNoOrCancelStub.firstCall.args[0] as { message: string };
      expect(promptCall.message).to.include(EXISTING_BUNDLE_API_NAME);
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
      expect(result.agentPath).to.include(`${EXISTING_BUNDLE_API_NAME}.agent`);
    });

    it('should cancel when user chooses cancel on duplicate prompt', async () => {
      yesNoOrCancelStub.resolves('cancel');

      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'Willie Resort Manager',
        '--api-name',
        EXISTING_BUNDLE_API_NAME,
        '--target-org',
        'test@org.com',
      ]);

      expect(yesNoOrCancelStub.calledOnce).to.be.true;
      expect(createAuthoringBundleStub.called).to.be.false;
      expect(result.agentPath).to.equal('');
    });

    it('should re-prompt for name and API name when user chooses no on duplicate prompt', async () => {
      yesNoOrCancelStub.resolves(false);
      // inputStub is called for both name and API name re-prompts
      inputStub.onFirstCall().resolves('New Agent');
      inputStub.onSecondCall().resolves('NewAgent');

      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'Willie Resort Manager',
        '--api-name',
        EXISTING_BUNDLE_API_NAME,
        '--target-org',
        'test@org.com',
      ]);

      expect(yesNoOrCancelStub.calledOnce).to.be.true;
      expect(inputStub.calledTwice).to.be.true;
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
      const callArgs = createAuthoringBundleStub.firstCall.args[0] as CreateAuthoringBundleArgs;
      expect(callArgs.bundleApiName).to.equal('NewAgent');
      expect(callArgs.agentSpec.name).to.equal('New Agent');
      expect(result.agentPath).to.include('NewAgent.agent');
    });

    it('should skip duplicate check with --force-overwrite', async () => {
      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'Willie Resort Manager',
        '--api-name',
        EXISTING_BUNDLE_API_NAME,
        '--force-overwrite',
        '--target-org',
        'test@org.com',
      ]);

      expect(yesNoOrCancelStub.called).to.be.false;
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
      expect(result.agentPath).to.include(`${EXISTING_BUNDLE_API_NAME}.agent`);
    });

    it('should not prompt when API name does not exist locally', async () => {
      const result = await AgentGenerateAuthoringBundle.run([
        '--no-spec',
        '--name',
        'Brand New Agent',
        '--api-name',
        'BrandNewAgent',
        '--target-org',
        'test@org.com',
      ]);

      expect(yesNoOrCancelStub.called).to.be.false;
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
      expect(result.agentPath).to.include('BrandNewAgent.agent');
    });
  });

  describe('when --json is used', () => {
    it('should throw when --name is not specified', async () => {
      try {
        await AgentGenerateAuthoringBundle.run([
          '--json',
          '--no-spec',
          '--api-name',
          'MyAgent',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.include('you must also specify --name');
      }
    });

    it('should throw when neither --spec nor --no-spec is specified', async () => {
      try {
        await AgentGenerateAuthoringBundle.run([
          '--json',
          '--name',
          'My Agent',
          '--api-name',
          'MyAgent',
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.include('you must also specify either --spec or --no-spec');
      }
    });

    it('should throw when existing AAB matches api-name and --force-overwrite is not set', async () => {
      const EXISTING_BUNDLE_API_NAME = 'Willie_Resort_Manager';
      try {
        await AgentGenerateAuthoringBundle.run([
          '--json',
          '--no-spec',
          '--name',
          'Willie Resort Manager',
          '--api-name',
          EXISTING_BUNDLE_API_NAME,
          '--target-org',
          'test@org.com',
        ]);
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.include(EXISTING_BUNDLE_API_NAME);
        expect((error as Error).message).to.include('--force-overwrite');
      }
    });

    it('should use generateApiName(name) as api-name when --api-name is omitted and not prompt', async () => {
      const result = await AgentGenerateAuthoringBundle.run([
        '--json',
        '--no-spec',
        '--name',
        'My Custom Agent',
        '--target-org',
        'test@org.com',
      ]);

      expect(inputStub.called).to.be.false;
      const expectedApiName = generateApiName('My Custom Agent');
      expect(result.outputDir).to.include(expectedApiName);
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
      const callArgs = createAuthoringBundleStub.firstCall.args[0] as CreateAuthoringBundleArgs;
      expect(callArgs.bundleApiName).to.equal(expectedApiName);
      expect(callArgs.agentSpec.name).to.equal('My Custom Agent');
    });

    it('should succeed with --json when all required flags provided and no existing AAB', async () => {
      const result = await AgentGenerateAuthoringBundle.run([
        '--json',
        '--no-spec',
        '--name',
        'Json Agent',
        '--api-name',
        'JsonAgent',
        '--target-org',
        'test@org.com',
      ]);

      expect(selectStub.called).to.be.false;
      expect(inputStub.called).to.be.false;
      expect(yesNoOrCancelStub.called).to.be.false;
      expect(result.agentPath).to.include('JsonAgent.agent');
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
    });

    it('should succeed with --json and --force-overwrite when existing AAB matches', async () => {
      const EXISTING_BUNDLE_API_NAME = 'Willie_Resort_Manager';
      const result = await AgentGenerateAuthoringBundle.run([
        '--json',
        '--no-spec',
        '--name',
        'Willie Resort Manager',
        '--api-name',
        EXISTING_BUNDLE_API_NAME,
        '--force-overwrite',
        '--target-org',
        'test@org.com',
      ]);

      expect(yesNoOrCancelStub.called).to.be.false;
      expect(createAuthoringBundleStub.calledOnce).to.be.true;
      expect(result.agentPath).to.include(`${EXISTING_BUNDLE_API_NAME}.agent`);
    });
  });
});
