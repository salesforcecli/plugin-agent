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

import * as fs from 'node:fs';
import { join } from 'node:path';
import { expect } from 'chai';
import { XMLParser } from 'fast-xml-parser';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import sinon from 'sinon';
import { ensureArray } from '@salesforce/kit';
import {
  ensureYamlExtension,
  getMetadataFilePaths,
  getPluginsAndFunctions,
  createCustomEvaluation,
} from '../../../../src/commands/agent/generate/test-spec.js';

describe('AgentGenerateTestSpec Helper Methods', () => {
  describe('getPluginsAndFunctions', () => {
    const $$ = sinon.createSandbox();

    afterEach(() => {
      $$.restore();
    });
    it('should getPluginsAndFunctions for a name and CS', async () => {
      const name = 'myAgent';
      const cs = new ComponentSet([
        { fullName: name, type: { name: 'Bot', id: 'bot', directoryName: 'bot' } },
        {
          fullName: 'myGenAiPlanner',
          type: { name: 'GenAiPlanner', id: 'genaiplanner', directoryName: 'genaiplanner' },
        },
        {
          fullName: 'myGenAiPlannerBundle',
          type: { name: 'GenAiPlannerBundle', id: 'genaiplannerbundle', directoryName: 'genaiplannerbundle' },
        },
        {
          fullName: 'PluginName',
          type: { name: 'GenAiPlugin', id: 'genaiplugin', directoryName: 'genaiplugin' },
        },
        {
          fullName: 'PluginName2',
          type: { name: 'GenAiPlugin', id: 'genaiplugin', directoryName: 'genaiplugin' },
        },
      ]);

      $$.stub(cs, 'getComponentFilenamesByNameAndType')
        .onFirstCall()
        .returns(['myBot.bot-meta.xml'])
        // will try to read the old genAiPlanner, that's ok, throw, but will be caught locally
        .onSecondCall()
        .rejects()
        .onThirdCall()
        .returns(['myGenAiPlannerBundle.genAiPlannerBundle-meta.xml'])
        // 0-based, the 4th call
        .onCall(3)
        .returns(['PluginName.genAiPlugin-meta.xml'])
        .onCall(4)
        .returns(['PluginName2.genAiPlugin-meta.xml']);

      $$.stub(fs.promises, 'readFile')
        .onFirstCall()
        .resolves(
          `<?xml version="1.0" encoding="UTF-8"?>
<BotVersion xmlns="http://soap.sforce.com/2006/04/metadata">
    <conversationDefinitionPlanners>
        <genAiPlannerName>App_Dev_Agent</genAiPlannerName>
    </conversationDefinitionPlanners>
</BotVersion>
`
        )
        // will try to read the old genAiPlanner, that's ok, throw, but will be caught locally
        .onSecondCall()
        .rejects()
        .onThirdCall().resolves(`<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlannerBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Helps internal employees manage company events, including event lookup, venue booking, and announcement drafting.</description>
    <localTopicLinks>
        <genAiPluginName>ambiguous_question_16jKS000000CaeR</genAiPluginName>
    </localTopicLinks>
    <localTopics>
        <fullName>off_topic_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Redirect conversation to event-related topics when user request goes off-topic</description>
        <developerName>off_topic_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn4A</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn4A</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localDeveloperName>off_topic</localDeveloperName>
        <masterLabel>Off Topic</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <localTopics>
        <fullName>event_management_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Handle event lookup, venue booking, and event announcement requests</description>
        <developerName>event_management_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn49</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn49</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localActionLinks>
            <functionName>lookup_events_179KS000000Gn49</functionName>
        </localActionLinks>
        <localActionLinks>
            <functionName>book_venue_179KS000000Gn49</functionName>
        </localActionLinks>
        <localActions>
            <fullName>lookup_events_179KS000000Gn49</fullName>
            <description>Search for upcoming company events by date or category</description>
            <developerName>lookup_events_179KS000000Gn49</developerName>
            <invocationTarget>EventLookupController</invocationTarget>
            <invocationTargetType>apex</invocationTargetType>
            <isConfirmationRequired>false</isConfirmationRequired>
            <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
            <localDeveloperName>lookup_events</localDeveloperName>
            <masterLabel>Lookup Events</masterLabel>
        </localActions>
        <localActions>
            <fullName>book_venue_179KS000000Gn49</fullName>
            <description>Check venue availability and reserve a room for an event</description>
            <developerName>book_venue_179KS000000Gn49</developerName>
            <invocationTarget>VenueBookingController</invocationTarget>
            <invocationTargetType>apex</invocationTargetType>
            <isConfirmationRequired>false</isConfirmationRequired>
            <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
            <localDeveloperName>book_venue</localDeveloperName>
            <masterLabel>Book Venue</masterLabel>
        </localActions>
        <localDeveloperName>event_management</localDeveloperName>
        <masterLabel>Event Management</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <localTopics>
        <fullName>topic_selector_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Welcome the user and route to the appropriate topic based on their request</description>
        <developerName>topic_selector_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn48</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn48</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localDeveloperName>topic_selector</localDeveloperName>
        <masterLabel>Topic Selector</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <masterLabel>Event Coordinator</masterLabel>
    <plannerType>Atlas__ConcurrentMultiAgentOrchestration</plannerType>
</GenAiPlannerBundle>

`);

      const result = await getPluginsAndFunctions(name, cs);
      expect(result).to.deep.equal({
        genAiFunctions: ['lookup_events_179KS000000Gn49', 'book_venue_179KS000000Gn49'],
        genAiPlugins: {
          // eslint-disable-next-line camelcase
          ambiguous_question_16jKS000000CaeR: 'PluginName.genAiPlugin-meta.xml',
        },
      });
    });

    it('should not fail when theres no actions', async () => {
      const name = 'myAgent';
      const cs = new ComponentSet([
        { fullName: name, type: { name: 'Bot', id: 'bot', directoryName: 'bot' } },
        {
          fullName: 'myGenAiPlannerBundle',
          type: { name: 'GenAiPlannerBundle', id: 'genaiplannerbundle', directoryName: 'genaiplannerbundle' },
        },
      ]);

      $$.stub(cs, 'getComponentFilenamesByNameAndType')
        .onFirstCall()
        .returns(['myBot.bot-meta.xml'])
        .onSecondCall()
        .rejects() // genAiPlanner attempt
        .onThirdCall()
        .returns(['myGenAiPlannerBundle.genAiPlannerBundle-meta.xml']);

      $$.stub(fs.promises, 'readFile')
        .onFirstCall()
        .resolves(
          `<?xml version="1.0" encoding="UTF-8"?>
<BotVersion xmlns="http://soap.sforce.com/2006/04/metadata">
    <conversationDefinitionPlanners>
        <genAiPlannerName>App_Dev_Agent</genAiPlannerName>
    </conversationDefinitionPlanners>
</BotVersion>
`
        )
        .onSecondCall()
        .rejects() // genAiPlanner attempt
        .onThirdCall()
        .resolves(
          `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlannerBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Helps internal employees manage company events, including event lookup, venue booking, and announcement drafting.</description>
    <localTopicLinks>
        <genAiPluginName>ambiguous_question_16jKS000000CaeR</genAiPluginName>
    </localTopicLinks>
    <localTopicLinks>
        <genAiPluginName>event_management_16jKS000000CaeR</genAiPluginName>
    </localTopicLinks>
    <localTopicLinks>
        <genAiPluginName>off_topic_16jKS000000CaeR</genAiPluginName>
    </localTopicLinks>
    <localTopicLinks>
        <genAiPluginName>topic_selector_16jKS000000CaeR</genAiPluginName>
    </localTopicLinks>
    <localTopics>
        <fullName>off_topic_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Redirect conversation to event-related topics when user request goes off-topic</description>
        <developerName>off_topic_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn4A</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn4A</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localDeveloperName>off_topic</localDeveloperName>
        <masterLabel>Off Topic</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <localTopics>
        <fullName>event_management_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Handle event lookup, venue booking, and event announcement requests</description>
        <developerName>event_management_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn49</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn49</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localActionLinks>
            <functionName>lookup_events_179KS000000Gn49</functionName>
        </localActionLinks>
        <localActionLinks>
            <functionName>book_venue_179KS000000Gn49</functionName>
        </localActionLinks>
        <localActions>
            <fullName>lookup_events_179KS000000Gn49</fullName>
            <description>Search for upcoming company events by date or category</description>
            <developerName>lookup_events_179KS000000Gn49</developerName>
            <invocationTarget>EventLookupController</invocationTarget>
            <invocationTargetType>apex</invocationTargetType>
            <isConfirmationRequired>false</isConfirmationRequired>
            <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
            <localDeveloperName>lookup_events</localDeveloperName>
            <masterLabel>Lookup Events</masterLabel>
        </localActions>
        <localActions>
            <fullName>book_venue_179KS000000Gn49</fullName>
            <description>Check venue availability and reserve a room for an event</description>
            <developerName>book_venue_179KS000000Gn49</developerName>
            <invocationTarget>VenueBookingController</invocationTarget>
            <invocationTargetType>apex</invocationTargetType>
            <isConfirmationRequired>false</isConfirmationRequired>
            <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
            <localDeveloperName>book_venue</localDeveloperName>
            <masterLabel>Book Venue</masterLabel>
        </localActions>
        <localDeveloperName>event_management</localDeveloperName>
        <masterLabel>Event Management</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <localTopics>
        <fullName>topic_selector_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Welcome the user and route to the appropriate topic based on their request</description>
        <developerName>topic_selector_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn48</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn48</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localDeveloperName>topic_selector</localDeveloperName>
        <masterLabel>Topic Selector</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <localTopics>
        <fullName>ambiguous_question_16jKS000000CaeR</fullName>
        <canEscalate>false</canEscalate>
        <description>Ask for clarification when user request is unclear</description>
        <developerName>ambiguous_question_16jKS000000CaeR</developerName>
        <genAiPluginInstructions>
            <description>You are the Event Coordinator assistant, helping internal employees manage company events. Be professional, helpful, and concise.</description>
            <developerName>instruction0_179KS000000Gn47</developerName>
            <language>en_US</language>
            <masterLabel>instruction0_179KS000000Gn47</masterLabel>
            <sortOrder>1</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>
        <localDeveloperName>ambiguous_question</localDeveloperName>
        <masterLabel>Ambiguous Question</masterLabel>
        <pluginType>Topic</pluginType>
    </localTopics>
    <masterLabel>Event Coordinator</masterLabel>
    <plannerType>Atlas__ConcurrentMultiAgentOrchestration</plannerType>
</GenAiPlannerBundle>
`
        );

      const result = await getPluginsAndFunctions(name, cs);
      expect(result.genAiFunctions).to.deep.equal([undefined]);
    });
  });

  describe('ensureYamlExtension utility', () => {
    it('should preserve existing .yaml extension', () => {
      expect(ensureYamlExtension('test.yaml')).to.equal('test.yaml');
      expect(ensureYamlExtension(join('path', 'to', 'file.yaml'))).to.equal(join('path', 'to', 'file.yaml'));
    });

    it('should preserve existing .yml extension', () => {
      expect(ensureYamlExtension('test.yml')).to.equal('test.yml');
      expect(ensureYamlExtension(join('path', 'to', 'file.yml'))).to.equal(join('path', 'to', 'file.yml'));
    });

    it('should add .yaml extension to files without extension', () => {
      expect(ensureYamlExtension('test')).to.equal('test.yaml');
      expect(ensureYamlExtension(join('path', 'to', 'file'))).to.equal(join('path', 'to', 'file.yaml'));
    });

    it('should replace other extensions with .yaml', () => {
      expect(ensureYamlExtension('test.txt')).to.equal('test.yaml');
      expect(ensureYamlExtension('test.json')).to.equal('test.yaml');
      expect(ensureYamlExtension(join('path', 'to', 'file.xml'))).to.equal(join('path', 'to', 'file.yaml'));
    });

    it('should handle complex paths correctly', () => {
      expect(ensureYamlExtension(join('/', 'absolute', 'path', 'file.txt'))).to.equal(
        join('/', 'absolute', 'path', 'file.yaml')
      );
      expect(ensureYamlExtension(join('..', 'relative', 'path', 'file'))).to.equal(
        join('..', 'relative', 'path', 'file.yaml')
      );
      expect(ensureYamlExtension(join('.', 'current', 'file.yaml'))).to.equal(join('.', 'current', 'file.yaml'));
    });
  });

  describe('XML parsing functionality', () => {
    let parser: XMLParser;

    beforeEach(() => {
      parser = new XMLParser();
    });

    it('should parse BotVersion XML correctly', () => {
      const xmlContent = `
        <BotVersion>
          <conversationDefinitionPlanners>
            <genAiPlannerName>TestPlanner</genAiPlannerName>
          </conversationDefinitionPlanners>
        </BotVersion>
      `;

      const parsed = parser.parse(xmlContent) as {
        BotVersion: { conversationDefinitionPlanners: { genAiPlannerName: string } };
      };

      expect(parsed.BotVersion.conversationDefinitionPlanners.genAiPlannerName).to.equal('TestPlanner');
    });

    it('should parse GenAiPlannerBundle XML correctly', () => {
      const xmlContent = `
        <GenAiPlannerBundle>
          <genAiPlugins>
            <genAiPluginName>Plugin1</genAiPluginName>
          </genAiPlugins>
          <genAiPlugins>
            <genAiPluginName>Plugin2</genAiPluginName>
          </genAiPlugins>
        </GenAiPlannerBundle>
      `;

      const parsed = parser.parse(xmlContent) as {
        GenAiPlannerBundle: {
          genAiPlugins: Array<{ genAiPluginName: string }>;
        };
      };

      expect(parsed.GenAiPlannerBundle.genAiPlugins).to.have.length(2);
      expect(parsed.GenAiPlannerBundle.genAiPlugins[0].genAiPluginName).to.equal('Plugin1');
      expect(parsed.GenAiPlannerBundle.genAiPlugins[1].genAiPluginName).to.equal('Plugin2');
    });

    it('should parse GenAiPlugin XML correctly', () => {
      const xmlContent = `
        <GenAiPlugin>
          <genAiFunctions>
            <functionName>Function1</functionName>
          </genAiFunctions>
          <genAiFunctions>
            <functionName>Function2</functionName>
          </genAiFunctions>
        </GenAiPlugin>
      `;

      const parsed = parser.parse(xmlContent) as {
        GenAiPlugin: { genAiFunctions: Array<{ functionName: string }> };
      };

      expect(parsed.GenAiPlugin.genAiFunctions).to.have.length(2);
      expect(parsed.GenAiPlugin.genAiFunctions[0].functionName).to.equal('Function1');
      expect(parsed.GenAiPlugin.genAiFunctions[1].functionName).to.equal('Function2');
    });

    it('should handle single element arrays in XML', () => {
      const xmlContent = `
        <GenAiPlannerBundle>
          <genAiPlugins>
            <genAiPluginName>SinglePlugin</genAiPluginName>
          </genAiPlugins>
        </GenAiPlannerBundle>
      `;

      const parsed = parser.parse(xmlContent) as {
        GenAiPlannerBundle: { genAiPlugins: { genAiPluginName: string } };
      };

      // XMLParser might return a single object instead of array for single elements
      // This is why ensureArray is needed in the original code
      expect(parsed.GenAiPlannerBundle.genAiPlugins).to.exist;
    });

    it('should parse complex GenAiPlugin with multiple functions and instructions', () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlugin xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <canEscalate>false</canEscalate>
    <description>Handles inquiries related to constructing, optimizing, and troubleshooting SOQL queries.</description>
    <developerName>SOQL_Query_Expert</developerName>
    <genAiFunctions>
        <functionName>DataCloudAgent__getCdpDataModelObjectMappingCollection</functionName>
    </genAiFunctions>
    <genAiFunctions>
        <functionName>EmployeeCopilot__IdentifyObjectByName</functionName>
    </genAiFunctions>
    <genAiPluginInstructions>
        <description>Assist in troubleshooting errors in SOQL queries by identifying syntax or logical issues.</description>
        <developerName>instruction_assistintr2</developerName>
        <language xsi:nil="true"/>
        <masterLabel>instruction_assistintr2</masterLabel>
    </genAiPluginInstructions>
    <genAiPluginInstructions>
        <description>Explain the use of filters, sorting, and relationships in SOQL queries.</description>
        <developerName>instruction_explainthe3</developerName>
        <language xsi:nil="true"/>
        <masterLabel>instruction_explainthe3</masterLabel>
    </genAiPluginInstructions>
    <genAiPluginInstructions>
        <description>Offer examples of common SOQL query patterns for different use cases.</description>
        <developerName>instruction_offerexamp1</developerName>
        <language xsi:nil="true"/>
        <masterLabel>instruction_offerexamp1</masterLabel>
    </genAiPluginInstructions>
    <genAiPluginInstructions>
        <description>Provide guidance on how to structure SOQL queries based on user requirements.</description>
        <developerName>instruction_providegui0</developerName>
        <language xsi:nil="true"/>
        <masterLabel>instruction_providegui0</masterLabel>
    </genAiPluginInstructions>
    <genAiPluginInstructions>
        <description>Suggest best practices for optimizing SOQL queries for performance.</description>
        <developerName>instruction_suggestbes4</developerName>
        <language xsi:nil="true"/>
        <masterLabel>instruction_suggestbes4</masterLabel>
    </genAiPluginInstructions>
    <language>en_US</language>
    <localDeveloperName>SOQL_Query_Expert</localDeveloperName>
    <masterLabel>SOQL Query Expert</masterLabel>
    <pluginType>Topic</pluginType>
    <scope>Your job is only to assist with SOQL query-related tasks, including query creation, optimization, and debugging. You are not to handle tasks outside this scope, such as general Salesforce administration or unrelated database queries.</scope>
</GenAiPlugin>`;

      const parsed = parser.parse(xmlContent) as {
        GenAiPlugin: {
          canEscalate: boolean;
          description: string;
          developerName: string;
          genAiFunctions: Array<{ functionName: string }>;
          genAiPluginInstructions: Array<{
            description: string;
            developerName: string;
            masterLabel: string;
          }>;
          language: string;
          localDeveloperName: string;
          masterLabel: string;
          pluginType: string;
          scope: string;
        };
      };

      // Verify basic properties
      expect(parsed.GenAiPlugin.developerName).to.equal('SOQL_Query_Expert');
      expect(parsed.GenAiPlugin.masterLabel).to.equal('SOQL Query Expert');
      expect(parsed.GenAiPlugin.pluginType).to.equal('Topic');
      expect(parsed.GenAiPlugin.canEscalate).to.equal(false);

      // Verify genAiFunctions array
      expect(parsed.GenAiPlugin.genAiFunctions).to.have.length(2);
      expect(parsed.GenAiPlugin.genAiFunctions[0].functionName).to.equal(
        'DataCloudAgent__getCdpDataModelObjectMappingCollection'
      );
      expect(parsed.GenAiPlugin.genAiFunctions[1].functionName).to.equal('EmployeeCopilot__IdentifyObjectByName');

      // Verify genAiPluginInstructions array
      expect(parsed.GenAiPlugin.genAiPluginInstructions).to.have.length(5);
      expect(parsed.GenAiPlugin.genAiPluginInstructions[0].developerName).to.equal('instruction_assistintr2');
      expect(parsed.GenAiPlugin.genAiPluginInstructions[0].description).to.equal(
        'Assist in troubleshooting errors in SOQL queries by identifying syntax or logical issues.'
      );
      expect(parsed.GenAiPlugin.genAiPluginInstructions[4].developerName).to.equal('instruction_suggestbes4');

      // Test that ensureArray would work with these functions
      const functionNames = ensureArray(parsed.GenAiPlugin.genAiFunctions ?? []).map((f) => f.functionName);

      expect(functionNames).to.deep.equal([
        'DataCloudAgent__getCdpDataModelObjectMappingCollection',
        'EmployeeCopilot__IdentifyObjectByName',
      ]);
    });
  });

  describe('data transformation utilities', () => {
    it('should extract function names from GenAiPlugin structure', () => {
      const mockParsedPlugin = {
        GenAiPlugin: {
          genAiFunctions: [{ functionName: 'Function1' }, { functionName: 'Function2' }, { functionName: 'Function3' }],
        },
      };

      const functionNames = ensureArray(mockParsedPlugin.GenAiPlugin.genAiFunctions ?? []).map((f) => f.functionName);

      expect(functionNames).to.deep.equal(['Function1', 'Function2', 'Function3']);
    });

    it('should handle empty or undefined genAiFunctions', () => {
      const mockParsedPlugin = {
        GenAiPlugin: {
          genAiFunctions: undefined,
        },
      };

      const functionNames = ensureArray(mockParsedPlugin.GenAiPlugin.genAiFunctions ?? []).map(
        (f: { functionName: string }) => f.functionName
      );

      expect(functionNames).to.deep.equal([]);
    });

    it('should create filename mapping from component data', () => {
      // Mock ComponentSet with required methods
      const mockComponentSet = {
        filter: (predicate: (component: unknown) => boolean) => {
          const components = [
            { fullName: 'Bot1', type: { name: 'Bot' } },
            { fullName: 'Bot2', type: { name: 'Bot' } },
            { fullName: '*', type: { name: 'Bot' } },
            { fullName: 'Plugin1', type: { name: 'GenAiPlugin' } },
          ];
          return components.filter(predicate);
        },
        getComponentFilenamesByNameAndType: ({ fullName }: { fullName: string }) => {
          const fileMap: Record<string, string> = {
            Bot1: join('/', 'path', 'to', 'bot1.xml'),
            Bot2: join('/', 'path', 'to', 'bot2.xml'),
            '*': join('/', 'path', 'to', 'wildcard.xml'),
            Plugin1: join('/', 'path', 'to', 'plugin1.xml'),
          };
          return [fileMap[fullName]];
        },
      } as unknown as ComponentSet;

      const result = getMetadataFilePaths(mockComponentSet, 'Bot');

      expect(result).to.deep.equal({
        Bot1: join('/', 'path', 'to', 'bot1.xml'),
        Bot2: join('/', 'path', 'to', 'bot2.xml'),
      });
      expect(result).to.not.have.property('*');
    });
  });

  describe('createCustomEvaluation', () => {
    it('should create correct structure for string comparison', () => {
      const evaluation = createCustomEvaluation('Test Label', '$.response.message', 'equals', 'expected text');

      expect(evaluation).to.deep.equal({
        label: 'Test Label',
        name: 'string_comparison',
        parameters: [
          { name: 'operator', value: 'equals', isReference: false },
          { name: 'actual', value: '$.response.message', isReference: true },
          { name: 'expected', value: 'expected text', isReference: false },
        ],
      });
    });

    it('should create correct structure for numeric comparison', () => {
      const evaluation = createCustomEvaluation('Numeric Test', '$.metrics.score', 'greater_than_or_equal', '85');

      expect(evaluation).to.deep.equal({
        label: 'Numeric Test',
        name: 'numeric_comparison',
        parameters: [
          { name: 'operator', value: 'greater_than_or_equal', isReference: false },
          { name: 'actual', value: '$.metrics.score', isReference: true },
          { name: 'expected', value: '85', isReference: false },
        ],
      });
    });

    it('should handle all supported operators', () => {
      const operators = ['equals', 'greater_than_or_equal', 'greater_than', 'less_than', 'less_than_or_equal'];

      operators.forEach((operator) => {
        const evaluation = createCustomEvaluation(`Test ${operator}`, '$.test.value', operator, '100');

        expect(evaluation.parameters[0]).to.deep.equal({
          name: 'operator',
          value: operator,
          isReference: false,
        });
      });
    });

    it('should always set correct isReference flags', () => {
      const evaluation = createCustomEvaluation('Reference Test', '$.actual.path', 'equals', 'expected');

      const [operatorParam, actualParam, expectedParam] = evaluation.parameters;

      expect(operatorParam.isReference).to.be.false;
      expect(actualParam.isReference).to.be.true; // actual is always a reference (JSONPath)
      expect(expectedParam.isReference).to.be.false; // expected is always a literal value
    });

    it('should correctly determine comparison type based on expected value', () => {
      const numericEvaluation = createCustomEvaluation('Test', '$.path', 'equals', '42');
      expect(numericEvaluation.name).to.equal('numeric_comparison');

      const stringEvaluation = createCustomEvaluation('Test', '$.path', 'equals', 'text');
      expect(stringEvaluation.name).to.equal('string_comparison');
    });

    it('should handle complex JSONPaths and values', () => {
      const evaluation = createCustomEvaluation(
        'Complex Test',
        '$.response.data[0].nested["special-key"].value',
        'less_than',
        '3.14159'
      );

      expect(evaluation.label).to.equal('Complex Test');
      expect(evaluation.name).to.equal('numeric_comparison');
      expect(evaluation.parameters[1].value).to.equal('$.response.data[0].nested["special-key"].value');
      expect(evaluation.parameters[2].value).to.equal('3.14159');
    });
  });
});
