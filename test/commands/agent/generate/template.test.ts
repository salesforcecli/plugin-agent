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

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { join } from 'node:path';
import { expect } from 'chai';
import esmock from 'esmock';
import { SfError } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';
import type { GenAiPlugin, GenAiFunction } from '@salesforce/types/metadata';
import { getLocalAssets, type GenAiPlannerBundleExt } from '../../../../src/commands/agent/generate/template.js';

const MOCK_PROJECT_DIR = join(process.cwd(), 'test', 'mock-projects', 'agent-generate-template');

const BOT_XML_NGA = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <agentDSLEnabled>true</agentDSLEnabled>
  <agentType>EinsteinServiceAgent</agentType>
  <botMlDomain><label>Test</label><name>TestBot</name></botMlDomain>
  <botSource>None</botSource>
  <label>Test Bot</label>
  <type>Conversational</type>
</Bot>`;

const BOT_XML_LEGACY = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <agentDSLEnabled>false</agentDSLEnabled>
  <agentType>EinsteinServiceAgent</agentType>
  <botMlDomain><label>Local Info Agent</label><name>Local_Info_Agent</name></botMlDomain>
  <botSource>None</botSource>
  <label>Local Info Agent</label>
  <type>Conversational</type>
</Bot>`;

const BOT_VERSION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<BotVersion xmlns="http://soap.sforce.com/2006/04/metadata">
  <entryDialog>Welcome</entryDialog>
  <botDialogs>
    <developerName>Welcome</developerName>
    <label>Welcome</label>
  </botDialogs>
  <botDialogs>
    <developerName>Other</developerName>
    <label>Other</label>
  </botDialogs>
  <conversationVariables/>
</BotVersion>`;

const BUNDLE_XML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlannerBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <masterLabel>Local Info Agent</masterLabel>
  <plannerType>AiCopilot__ReAct</plannerType>
</GenAiPlannerBundle>`;

describe('agent generate template', () => {
  const $$ = new TestContext();
  // Use existing bot in mock project so --agent-file exists check passes
  const agentFile = join(
    MOCK_PROJECT_DIR,
    'force-app',
    'main',
    'default',
    'bots',
    'Local_Info_Agent',
    'Local_Info_Agent.bot-meta.xml'
  );
  const outputDir = join(MOCK_PROJECT_DIR, 'force-app', 'main', 'default');
  const runArgs = (): string[] => [
    '--agent-file',
    agentFile,
    '--agent-version',
    '1',
    '--output-dir',
    outputDir,
    '--json',
  ];

  beforeEach(() => {
    $$.inProject(true);
    const mockProject = {
      getPath: () => MOCK_PROJECT_DIR,
      getDefaultPackage: () => ({ fullPath: join(MOCK_PROJECT_DIR, 'force-app') }),
    } as unknown as SfProject;
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject);
    $$.SANDBOX.stub(SfProject, 'getInstance').returns(mockProject);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should throw nga-agent-not-supported when is an NGA agent', async () => {
    let readCount = 0;
    const readFileSyncMock = (): string => {
      readCount += 1;
      return BOT_XML_NGA;
    };
    const mod = await esmock('../../../../src/commands/agent/generate/template.js', {
      'node:fs': {
        readFileSync: readFileSyncMock,
        mkdirSync: () => {},
        writeFileSync: () => {},
      },
    });
    const AgentGenerateTemplate = mod.default;

    try {
      await AgentGenerateTemplate.run(runArgs());
      expect.fail('Expected SfError (nga-agent-not-supported)');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      expect((error as SfError).message).to.match(/legacy agents|Agent Script|nga-agent-not-supported/i);
    }
    expect(readCount).to.equal(1);
  });

  it('should write BotTemplate and GenAiPlannerBundle under --output-dir', async () => {
    const customOutputDir = join(process.cwd(), 'tmp-template-output-test');
    const responses = [BOT_XML_LEGACY, BOT_VERSION_XML, BUNDLE_XML_EMPTY];
    let readIndex = 0;
    const readFileSyncMock = (): string => responses[readIndex++];
    const mod = await esmock('../../../../src/commands/agent/generate/template.js', {
      'node:fs': {
        readFileSync: readFileSyncMock,
        mkdirSync: () => {},
        writeFileSync: () => {},
        existsSync: () => false,
        statSync: () => ({ isDirectory: () => false }),
        cpSync: () => {},
      },
    });
    const AgentGenerateTemplate = mod.default;

    const result = await AgentGenerateTemplate.run([
      '--agent-file',
      agentFile,
      '--agent-version',
      '1',
      '--output-dir',
      customOutputDir,
      '--json',
    ]);

    expect(result).to.be.ok;
    expect(result.botTemplatePath).to.include(customOutputDir);
    expect(result.botTemplatePath).to.include('botTemplates');
    expect(result.botTemplatePath).to.match(/Local_Info_Agent_v1_Template\.botTemplate-meta\.xml$/);
    expect(result.genAiPlannerBundlePath).to.include(customOutputDir);
    expect(result.genAiPlannerBundlePath).to.include('genAiPlannerBundles');
    expect(result.genAiPlannerBundlePath).to.match(/Local_Info_Agent_v1_Template\.genAiPlannerBundle$/);
  });

  it('should throw local-topics-without-source when a local topic has no source', () => {
    const topicWithoutSource = { developerName: 'my_topic', fullName: 'my_topic' } as GenAiPlugin;
    const bundle = {
      GenAiPlannerBundle: {
        localTopicLinks: [],
        localTopics: [topicWithoutSource],
      },
    } as unknown as GenAiPlannerBundleExt;

    try {
      getLocalAssets(bundle);
      expect.fail('Expected SfError (local-topics-without-source)');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      expect((error as SfError).message).to.match(/local topic|genAiPlugin|global topic|local-topics-without-source/i);
    }
  });

  it('should throw local-actions-without-source when a local action has no source', () => {
    const actionWithoutSource = { developerName: 'my_action', fullName: 'my_action' } as GenAiFunction;
    const bundle = {
      GenAiPlannerBundle: {
        localTopicLinks: [],
        plannerActions: [actionWithoutSource],
      },
    } as unknown as GenAiPlannerBundleExt;

    try {
      getLocalAssets(bundle);
      expect.fail('Expected SfError (local-actions-without-source)');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      expect((error as SfError).message).to.match(
        /local action|genAiFunction|global action|local-actions-without-source/i
      );
    }
  });
  it('returns topics without actions when plugins have no localActions', () => {
    const topic = {
      developerName: 'topic_a',
      fullName: 'topic_a',
      source: 'GlobalTopic_A',
    } as GenAiPlugin;
    const bundle = {
      GenAiPlannerBundle: {
        localTopicLinks: [],
        localTopics: [topic],
      },
    } as unknown as GenAiPlannerBundleExt;

    const { localTopics, localActions } = getLocalAssets(bundle);

    expect(localTopics).to.have.length(1);
    expect(localTopics[0].developerName).to.equal('topic_a');
    expect(localTopics[0].source).to.equal('GlobalTopic_A');
    expect(localActions).to.deep.equal([]);
  });

  it('returns actions from both localActions (plugins) and plannerActions', () => {
    const actionFromPlugin = {
      developerName: 'plugin_action',
      fullName: 'plugin_action',
      source: 'GlobalPluginAction',
    } as GenAiFunction;
    const topicWithAction = {
      developerName: 'topic_b',
      fullName: 'topic_b',
      source: 'GlobalTopic_B',
      localActions: [actionFromPlugin],
    } as GenAiPlugin;
    const plannerAction = {
      developerName: 'planner_action',
      fullName: 'planner_action',
      source: 'GlobalPlannerAction',
    } as GenAiFunction;
    const bundle = {
      GenAiPlannerBundle: {
        localTopicLinks: [],
        localTopics: [topicWithAction],
        plannerActions: [plannerAction],
      },
    } as unknown as GenAiPlannerBundleExt;

    const { localTopics, localActions } = getLocalAssets(bundle);

    expect(localTopics).to.have.length(1);
    expect(localTopics[0].developerName).to.equal('topic_b');
    expect(localActions).to.have.length(2);
    expect(localActions[0].developerName).to.equal('plugin_action');
    expect(localActions[0].source).to.equal('GlobalPluginAction');
    expect(localActions[1].developerName).to.equal('planner_action');
    expect(localActions[1].source).to.equal('GlobalPlannerAction');
  });

  it('returns only plannerActions when there are no localTopics', () => {
    const plannerAction = {
      developerName: 'solo_planner',
      fullName: 'solo_planner',
      source: 'GlobalSoloAction',
    } as GenAiFunction;
    const bundle = {
      GenAiPlannerBundle: {
        localTopicLinks: [],
        localTopics: [],
        plannerActions: [plannerAction],
      },
    } as unknown as GenAiPlannerBundleExt;

    const { localTopics, localActions } = getLocalAssets(bundle);

    expect(localTopics).to.deep.equal([]);
    expect(localActions).to.have.length(1);
    expect(localActions[0].developerName).to.equal('solo_planner');
    expect(localActions[0].source).to.equal('GlobalSoloAction');
  });
});
