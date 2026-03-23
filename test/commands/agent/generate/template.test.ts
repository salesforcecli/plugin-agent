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
import esmock from 'esmock';
import sinon from 'sinon';
import type { Connection } from '@salesforce/core';
import { SfError } from '@salesforce/core';
import { TestContext, MockTestOrgData } from '@salesforce/core/testSetup';
import { SfProject } from '@salesforce/core';
import type { GenAiPlugin, GenAiFunction } from '@salesforce/types/metadata';
import {
  getLocalAssets,
  replaceReferencesToGlobalAssets,
  validateGlobalAssets,
  ALLOWED_GLOBAL_FUNCTIONS,
  type GenAiPlannerBundleExt,
} from '../../../../src/commands/agent/generate/template.js';

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

/** 18-char Salesforce Id shape (alphanumeric) for validateSalesforceId */
const LOCAL_ASSET_ID = 'aaaaaaaaaaaaaaaaaa';
const GLOBAL_ASSET_ID = 'bbbbbbbbbbbbbbbbbb';

describe('validateGlobalAssets', () => {
  /** jsforce passes SOQL string as the first argument to `tooling.query` */
  const makeConnection = (queryImpl: (soql: string) => Promise<{ records: any[] }>): Connection => {
    const stub = sinon.stub().callsFake((soql: string) => queryImpl(soql));
    return {
      tooling: { query: stub },
    } as unknown as Connection;
  };

  it('throws when a local topic is not found in the org', async () => {
    const topic = { fullName: 'GhostTopic', source: 'x' } as GenAiPlugin;
    const queryImpl = async (soql: string) => {
      if (soql.includes('GenAiPluginDefinition')) {
        return { records: [] };
      }
      return { records: [] };
    };
    const warn = sinon.spy();

    try {
      await validateGlobalAssets([topic], [], makeConnection(queryImpl), '', warn);
      expect.fail('expected SfError');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      expect((error as SfError).message).to.match(/source org|isn't in the source org/i);
      expect((error as SfError).message).to.include('GhostTopic');
    }
    expect(warn.called).to.be.false;
  });

  it('throws when a local topic references a global asset that is not found in the org', async () => {
    const topic = { fullName: 'LocTopic', source: 'x' } as GenAiPlugin;
    const queryImpl = async (soql: string) => {
      if (soql.includes('GenAiPluginDefinition')) {
        return {
          records: [
            {
              Id: LOCAL_ASSET_ID,
              DeveloperName: 'LocTopic',
              NamespacePrefix: null,
              IsLocal: true,
              Source: GLOBAL_ASSET_ID,
            },
          ],
        };
      }
      return { records: [] };
    };
    const warn = sinon.spy();

    try {
      await validateGlobalAssets([topic], [], makeConnection(queryImpl), '', warn);
      expect.fail('expected SfError');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      expect((error as SfError).message).to.include(GLOBAL_ASSET_ID);
    }
    expect(warn.called).to.be.false;
  });

  it('warns when the global asset is from a managed package other than the one in the sfdx-project.json', async () => {
    const topic = { fullName: 'LocTopic', source: 'x' } as GenAiPlugin;
    const queryImpl = async (soql: string) => {
      if (soql.includes('GenAiPluginDefinition')) {
        return {
          records: [
            {
              Id: LOCAL_ASSET_ID,
              DeveloperName: 'LocTopic',
              NamespacePrefix: null,
              IsLocal: true,
              Source: GLOBAL_ASSET_ID,
            },
            {
              Id: GLOBAL_ASSET_ID,
              DeveloperName: 'GlobalDev',
              NamespacePrefix: 'otherns',
              IsLocal: false,
              Source: null,
            },
          ],
        };
      }
      return { records: [] };
    };
    const warn = sinon.spy();
    await validateGlobalAssets([topic], [], makeConnection(queryImpl), 'myns', warn);

    expect(warn.calledOnce).to.be.true;
    expect(warn.firstCall.args[0]).to.match(/managed package|reference-asset/i);
    expect(warn.firstCall.args[0]).to.include('otherns__GlobalDev');
  });

  it('can validate local topics and actions for global assets that are from a managed package', async () => {
    const topic = { fullName: 'T1', source: 'x' } as GenAiPlugin;
    const action = { fullName: 'A1', source: 'x' } as GenAiFunction;
    const queryImpl = async (soql: string) => {
      if (soql.includes('GenAiPluginDefinition')) {
        return {
          records: [
            {
              Id: 'cccccccccccccccccc',
              DeveloperName: 'T1',
              NamespacePrefix: null,
              IsLocal: true,
              Source: 'dddddddddddddddddd',
            },
            {
              Id: 'dddddddddddddddddd',
              DeveloperName: 'G1',
              NamespacePrefix: 'pkgone',
              IsLocal: false,
              Source: null,
            },
          ],
        };
      }
      if (soql.includes('GenAiFunctionDefinition')) {
        return {
          records: [
            {
              Id: 'eeeeeeeeeeeeeeeeee',
              DeveloperName: 'A1',
              NamespacePrefix: null,
              IsLocal: true,
              Source: 'ffffffffffffffffff',
            },
            {
              Id: 'ffffffffffffffffff',
              DeveloperName: 'G2',
              NamespacePrefix: 'pkgtwo',
              IsLocal: false,
              Source: null,
            },
          ],
        };
      }
      return { records: [] };
    };
    const warn = sinon.spy();
    await validateGlobalAssets([topic], [action], makeConnection(queryImpl), 'myns', warn);

    expect(warn.calledOnce).to.be.true;
    const msg = warn.firstCall.args[0] as string;
    expect(msg).to.include('pkgone__G1');
    expect(msg).to.include('pkgtwo__G2');
  });

  it('can validate local topics and actions for global assets that are not found in the org', async () => {
    const topic = { fullName: 'MissingTopic', source: 'x' } as GenAiPlugin;
    const action = { fullName: 'MissingAction', source: 'x' } as GenAiFunction;
    const queryImpl = sinon.fake.resolves({ records: [] });
    const warn = sinon.spy();

    try {
      await validateGlobalAssets([topic], [action], makeConnection(queryImpl), '', warn);
      expect.fail('expected SfError');
    } catch (error) {
      expect(error).to.be.instanceOf(SfError);
      const msg = (error as SfError).message;
      expect(msg).to.include('MissingTopic');
      expect(msg).to.include('MissingAction');
    }
    expect(warn.called).to.be.false;
  });

  it('does not warn  when local topic Source is OOTB topic', async () => {
    const topic = { fullName: 'LocTopic', source: 'x' } as GenAiPlugin;
    const queryImpl = async (soql: string) => {
      if (soql.includes('GenAiPluginDefinition')) {
        return {
          records: [
            {
              Id: LOCAL_ASSET_ID,
              DeveloperName: 'LocTopic',
              NamespacePrefix: null,
              IsLocal: true,
              Source: 'StandardGlobalTopicName',
            },
          ],
        };
      }
      return { records: [] };
    };
    const warn = sinon.spy();
    await validateGlobalAssets([topic], [], makeConnection(queryImpl), '', warn);
    expect(warn.called).to.be.false;
  });

  it('does not warn  when local action Source is OOTB action', async () => {
    const action = { fullName: 'MyFn', source: 'x' } as GenAiFunction;
    const queryImpl = async (soql: string) => {
      if (soql.includes('GenAiFunctionDefinition')) {
        return {
          records: [
            {
              Id: LOCAL_ASSET_ID,
              DeveloperName: 'MyFn',
              NamespacePrefix: null,
              IsLocal: true,
              Source: 'SomeOOTBFunction',
            },
          ],
        };
      }
      return { records: [] };
    };
    const warn = sinon.spy();
    await validateGlobalAssets([], [action], makeConnection(queryImpl), '', warn);
    expect(warn.called).to.be.false;
  });
});

describe('agent generate template', () => {
  const $$ = new TestContext();
  const SOURCE_ORG = 'test@org.com';
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
    '--source-org',
    SOURCE_ORG,
    '--json',
  ];

  beforeEach(async () => {
    $$.inProject(true);
    const mockOrg = new MockTestOrgData($$.uniqid(), { username: SOURCE_ORG });
    await $$.stubAuths(mockOrg);
    const mockProject = {
      getPath: () => MOCK_PROJECT_DIR,
      getDefaultPackage: () => ({ fullPath: join(MOCK_PROJECT_DIR, 'force-app') }),
      resolveProjectConfig: async () => ({}),
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
      '--source-org',
      SOURCE_ORG,
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

  it('should copy metadata dirs to output-dir when they exist', async () => {
    const customOutputDir = join(process.cwd(), 'my-package');
    const basePath = join(MOCK_PROJECT_DIR, 'force-app', 'main', 'default');
    const responses = [BOT_XML_LEGACY, BOT_VERSION_XML, BUNDLE_XML_EMPTY];
    let readIndex = 0;
    const readFileSyncMock = (): string => responses[readIndex++];
    const cpSyncCalls: Array<{ src: string; dest: string; options: { recursive: boolean } }> = [];
    const dirsThatExist = new Set([join(basePath, 'genAiPlugins'), join(basePath, 'genAiFunctions')]);
    const mod = await esmock('../../../../src/commands/agent/generate/template.js', {
      'node:fs': {
        readFileSync: readFileSyncMock,
        mkdirSync: () => {},
        writeFileSync: () => {},
        existsSync: (path: string) => dirsThatExist.has(path),
        statSync: (path: string) => ({ isDirectory: () => dirsThatExist.has(path) }),
        cpSync: (src: string, dest: string, options: { recursive: boolean }) => {
          cpSyncCalls.push({ src, dest, options });
        },
      },
    });
    const AgentGenerateTemplate = mod.default;

    await AgentGenerateTemplate.run([
      '--agent-file',
      agentFile,
      '--agent-version',
      '1',
      '--output-dir',
      customOutputDir,
      '--source-org',
      SOURCE_ORG,
      '--json',
    ]);

    expect(cpSyncCalls).to.have.length(2);
    expect(cpSyncCalls.map((c) => c.src)).to.include(join(basePath, 'genAiPlugins'));
    expect(cpSyncCalls.map((c) => c.src)).to.include(join(basePath, 'genAiFunctions'));
    expect(cpSyncCalls.map((c) => c.dest)).to.include(join(customOutputDir, 'genAiPlugins'));
    expect(cpSyncCalls.map((c) => c.dest)).to.include(join(customOutputDir, 'genAiFunctions'));
    for (const call of cpSyncCalls) {
      expect(call.options).to.deep.equal({ recursive: true });
    }
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

  describe('replaceReferencesToGlobalAssets (localActionLinks → genAiFunctions)', () => {
    it('sets genAiFunctions to allowed globals when a localActionLink resolves to one', () => {
      const [allowedGlobal] = [...ALLOWED_GLOBAL_FUNCTIONS];
      const localAction = {
        developerName: 'AnswerQuestionsWithKnowledge',
        fullName: 'AnswerQuestionsWithKnowledge',
        source: allowedGlobal,
      } as GenAiFunction;
      const topic = {
        developerName: 'topic_a',
        fullName: 'topic_a',
        source: 'GlobalTopic_A',
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          localActionLinks: [{ genAiFunctionName: 'AnswerQuestionsWithKnowledge' }],
          plannerActions: [localAction],
          genAiPlugins: [],
          genAiFunctions: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      expect(bundle.GenAiPlannerBundle.genAiFunctions).to.deep.equal([{ genAiFunctionName: allowedGlobal }]);
      expect(bundle.GenAiPlannerBundle.localActionLinks).to.deep.equal([]);
    });

    it('sets genAiFunctions to [] when no localActionLink resolves to an allowed global', () => {
      const localAction = {
        developerName: 'OtherAction',
        fullName: 'OtherAction',
        source: 'SomePackage__OtherGlobalAction',
      } as GenAiFunction;
      const topic = {
        developerName: 'topic_a',
        fullName: 'topic_a',
        source: 'GlobalTopic_A',
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          localActionLinks: [{ genAiFunctionName: 'OtherAction' }],
          plannerActions: [localAction],
          genAiPlugins: [],
          genAiFunctions: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      expect(bundle.GenAiPlannerBundle.genAiFunctions).to.deep.equal([]);
      expect(bundle.GenAiPlannerBundle.localActionLinks).to.deep.equal([]);
    });
  });

  describe('replaceReferencesToGlobalAssets (genAiPlugins and clearing local state)', () => {
    it('sets genAiPlugins from topic.source, clears localTopicLinks, localTopics, and plannerActions', () => {
      const topic = {
        developerName: 't1',
        fullName: 'Local_Topic_A',
        source: 'Global_Topic_A',
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [{ genAiPluginName: 'Local_Topic_A' }],
          localTopics: [topic],
          plannerActions: [{ developerName: 'pa', fullName: 'pa', source: 'GlobalPa' } as GenAiFunction],
          genAiPlugins: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      expect(bundle.GenAiPlannerBundle.genAiPlugins).to.deep.equal([{ genAiPluginName: 'Global_Topic_A' }]);
      expect(bundle.GenAiPlannerBundle.localTopicLinks).to.deep.equal([]);
      expect(bundle.GenAiPlannerBundle.localTopics).to.deep.equal([]);
      expect(bundle.GenAiPlannerBundle.plannerActions).to.deep.equal([]);
    });
  });

  describe('replaceReferencesToGlobalAssets (attributeMappings / ruleExpressionAssignments)', () => {
    it('replaces local topic segments in attributeMappings.attributeName with global names from source', () => {
      const topic = {
        developerName: 'Local_Events_Information',
        fullName: 'Local_Events_Information',
        source: 'Weather_and_Temperature_Information',
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          attributeMappings: [
            {
              attributeName: 'Local_Events_Information.MyNs__MyAction.input_customerId',
              attributeType: 'CustomPluginFunctionAttribute',
              mappingTargetName: 'customerId',
              mappingType: 'Variable',
            },
          ],
          genAiPlugins: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      const mappings = bundle.GenAiPlannerBundle.attributeMappings as Array<{ attributeName: string }>;
      expect(mappings[0].attributeName).to.equal('Weather_and_Temperature_Information.MyNs__MyAction.input_customerId');
    });

    it('replaces local topic segments in ruleExpressionAssignments.targetName', () => {
      const topic = {
        developerName: 'Resort_History_Information',
        fullName: 'Resort_History_Information',
        source: 'Global_ResortHistory',
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          ruleExpressionAssignments: [
            {
              targetName: 'Resort_History_Information.someField',
              expression: 'true',
            },
          ],
          genAiPlugins: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      const assignments = bundle.GenAiPlannerBundle.ruleExpressionAssignments as Array<{ targetName: string }>;
      expect(assignments[0].targetName).to.equal('Global_ResortHistory.someField');
    });

    it('replaces planner action fullName segments when present in dot-separated attributeName', () => {
      const topic = {
        developerName: 'topic_z',
        fullName: 'topic_z',
        source: 'Global_Topic_Z',
      } as GenAiPlugin;
      const plannerAction = {
        developerName: 'PlannerAct',
        fullName: 'PlannerAct',
        source: 'Global_PlannerAct',
      } as GenAiFunction;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          plannerActions: [plannerAction],
          attributeMappings: [
            {
              attributeName: 'PlannerAct.OtherNs__Fn.output_x',
              attributeType: 'CustomPluginFunctionAttribute',
              mappingTargetName: 'x',
              mappingType: 'Variable',
            },
          ],
          genAiPlugins: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      const mappings = bundle.GenAiPlannerBundle.attributeMappings as Array<{ attributeName: string }>;
      expect(mappings[0].attributeName).to.equal('Global_PlannerAct.OtherNs__Fn.output_x');
    });

    it('replaces plugin localAction fullName segments in attributeMappings (from topic.localActions)', () => {
      const pluginAction = {
        developerName: 'CloseCase',
        fullName: 'CloseCase',
        source: 'SvcCopilotTmpl__CloseCaseGlobal',
      } as GenAiFunction;
      const topic = {
        developerName: 'topic_x',
        fullName: 'EmployeeCaseManagement',
        source: 'GlobalTopicX',
        localActions: [pluginAction],
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          attributeMappings: [
            {
              attributeName: 'EmployeeCaseManagement.CloseCase.input_caseId',
              attributeType: 'CustomPluginFunctionAttribute',
              mappingTargetName: 'caseId',
              mappingType: 'Variable',
            },
          ],
          genAiPlugins: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      const mappings = bundle.GenAiPlannerBundle.attributeMappings as Array<{ attributeName: string }>;
      expect(mappings[0].attributeName).to.equal('GlobalTopicX.SvcCopilotTmpl__CloseCaseGlobal.input_caseId');
    });

    it('normalizes single attributeMapping object (non-array) before replacing', () => {
      const topic = {
        fullName: 'L1',
        source: 'G1',
      } as GenAiPlugin;
      const bundle = {
        GenAiPlannerBundle: {
          localTopicLinks: [],
          localTopics: [topic],
          attributeMappings: {
            attributeName: 'L1.ns__Fn.out',
            attributeType: 'x',
            mappingTargetName: 'y',
            mappingType: 'Variable',
          },
          genAiPlugins: [],
        },
      } as unknown as GenAiPlannerBundleExt;

      replaceReferencesToGlobalAssets(bundle, [topic]);

      const raw = bundle.GenAiPlannerBundle.attributeMappings;
      const first = Array.isArray(raw) ? raw[0] : raw;
      expect((first as { attributeName: string }).attributeName).to.equal('G1.ns__Fn.out');
    });
  });
});
