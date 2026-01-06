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
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { XMLParser } from 'fast-xml-parser';
import { expect } from 'chai';
import {
  AgentGenerateTemplateResult,
  BotTemplateExt,
  GenAiPlannerBundleExt,
} from '../../src/commands/agent/generate/template.js';
import { getTestSession } from './shared-setup.js';

describe('agent generate template NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await getTestSession();
  });

  after(async () => {
    // mocha tests run in series, alphabetically, meaning this is the last NUT (for now)
    // cleanup should be done in the last test
    await session?.clean();
  });

  it('throws an error if Bot "type" is equal to "Bot"', async () => {
    const agentVersion = 1;
    const agentFile = join('force-app', 'main', 'default', 'bots', 'Bot_Agent', 'Bot_Agent.bot-meta.xml');
    const command = `agent generate template --agent-version ${agentVersion} --agent-file "${agentFile}" --json`;
    const output = execCmd<AgentGenerateTemplateResult>(command, { ensureExitCode: 1 }).jsonOutput;

    expect(output?.message).to.include(
      "The 'type' attribute of this Bot metadata component XML file can't have a value of 'Bot'"
    );
  });

  it('Converts an Agent into an BotTemplate and GenAiPlannerBundle', async () => {
    const agentVersion = 1;
    const agentFile = join(
      'force-app',
      'main',
      'default',
      'bots',
      'Guest_Experience_Agent',
      'Guest_Experience_Agent.bot-meta.xml'
    );
    const command = `agent generate template --agent-version ${agentVersion} --agent-file "${agentFile}" --json`;
    const output = execCmd<AgentGenerateTemplateResult>(command, {
      ensureExitCode: 0,
    }).jsonOutput;

    const botTemplateFilePath = join(
      'force-app',
      'main',
      'default',
      'botTemplates',
      'Guest_Experience_Agent_v1_Template.botTemplate-meta.xml'
    );
    const genAiPlannerBundleFilePath = join(
      'force-app',
      'main',
      'default',
      'genAiPlannerBundles',
      'Guest_Experience_Agent_v1_Template',
      'Guest_Experience_Agent_v1_Template.genAiPlannerBundle'
    );

    const generatedBotTemplateFilePath = resolve(session.project.dir, botTemplateFilePath);
    const generatedGenAiPlannerBundleFilePath = resolve(session.project.dir, genAiPlannerBundleFilePath);
    // Ensure it returns the paths to the generated files
    expect(output?.result.botTemplatePath).to.equal(generatedBotTemplateFilePath);
    expect(output?.result.genAiPlannerBundlePath).to.equal(generatedGenAiPlannerBundleFilePath);

    // Compare generated files with mock files
    const mockBotTemplateFilePath = join(
      'test',
      'mock-projects',
      'agent-generate-template',
      'MOCK-XML',
      botTemplateFilePath
    );
    const mockGenAiPlannerBundleFilePath = join(
      'test',
      'mock-projects',
      'agent-generate-template',
      'MOCK-XML',
      genAiPlannerBundleFilePath
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (name) => ['botDialogs', 'contextVariables', 'contextVariableMappings', 'botSteps'].includes(name),
    });

    // read both files and compare them
    const generatedBotTemplateFile = parser.parse(
      readFileSync(generatedBotTemplateFilePath, 'utf-8')
    ) as BotTemplateExt;
    const mockBotTemplateFile = parser.parse(readFileSync(mockBotTemplateFilePath, 'utf-8')) as BotTemplateExt;
    expect(generatedBotTemplateFile).to.deep.equal(mockBotTemplateFile);

    // Verify that mainMenuDialog and Main_Menu dialog are not present in the generated template
    expect(generatedBotTemplateFile.BotTemplate).to.not.have.property('mainMenuDialog');
    expect(generatedBotTemplateFile.BotTemplate.botDialogs).to.be.an('array').with.lengthOf(1);
    expect(generatedBotTemplateFile.BotTemplate.botDialogs[0].developerName).to.not.equal('Main_Menu');
    expect(generatedBotTemplateFile.BotTemplate).to.not.have.property('agentTemplate');
    expect(generatedBotTemplateFile.BotTemplate).to.not.have.property('agentDSLEnabled');
    expect(generatedBotTemplateFile.BotTemplate).to.not.have.property('Main_Menu_Dialog');
    expect(generatedBotTemplateFile.BotTemplate).to.not.have.property('botSource');

    const generatedGenAiPlannerBundleFile = parser.parse(
      readFileSync(generatedGenAiPlannerBundleFilePath, 'utf-8')
    ) as GenAiPlannerBundleExt;
    const mockGenAiPlannerBundleFile = parser.parse(
      readFileSync(mockGenAiPlannerBundleFilePath, 'utf-8')
    ) as GenAiPlannerBundleExt;
    expect(generatedGenAiPlannerBundleFile).to.deep.equal(mockGenAiPlannerBundleFile);
  });
});
