/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentGenerateTemplateResult } from '../../../../src/commands/agent/generate/template.js';

describe('agent generate template NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'NONE',
      project: { sourceDir: join('test', 'mock-projects', 'agent-generate-template') },
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('throws an error if Bot "type" is equal to "Bot"', async () => {
    const agentVersion = 1;
    const agentFile = 'force-app/main/default/bots/Local_Info_Agent/Local_Info_Agent.bot-meta.xml';
    const command = `agent generate template --agent-version ${agentVersion} --agent-file "${agentFile}" --json`;
    const output = execCmd<AgentGenerateTemplateResult>(command, {
      ensureExitCode: 1,
    }).jsonOutput;

    expect(output?.message).to.include(
      "The 'type' attribute of this Bot metadata component XML file can't have a value of 'Bot'"
    );
  });

  it('Converts an Agent into an BotTemplate and GenAiPlanner', async () => {
    const agentVersion = 1;
    const agentFile = 'force-app/main/default/bots/Guest_Experience_Agent/Guest_Experience_Agent.bot-meta.xml';
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
    const genAiPlannerFilePath = join(
      'force-app',
      'main',
      'default',
      'genAiPlanners',
      'Guest_Experience_Agent_v1_Template.genAiPlanner-meta.xml'
    );

    const generatedBotTemplateFilePath = resolve(session.project.dir, botTemplateFilePath);
    const generatedGenAiPlannerFilePath = resolve(session.project.dir, genAiPlannerFilePath);
    // Ensure it returns the paths to the generated files
    expect(output?.result.botTemplatePath).to.equal(generatedBotTemplateFilePath);
    expect(output?.result.genAiPlannerPath).to.equal(generatedGenAiPlannerFilePath);

    // Compare generated files with mock files
    const mockBotTemplateFilePath = join(
      'test',
      'mock-projects',
      'agent-generate-template',
      'MOCK-XML',
      botTemplateFilePath
    );
    const mockGenAiPlannerFilePath = join(
      'test',
      'mock-projects',
      'agent-generate-template',
      'MOCK-XML',
      genAiPlannerFilePath
    );

    // read both files and compare them
    const generatedBotTemplateFile = readFileSync(generatedBotTemplateFilePath, 'utf-8');
    const mockBotTemplateFile = readFileSync(mockBotTemplateFilePath, 'utf-8');
    expect(generatedBotTemplateFile).to.equal(mockBotTemplateFile);

    const generatedGenAiPlannerFile = readFileSync(generatedGenAiPlannerFilePath, 'utf-8');
    const mockGenAiPlannerFile = readFileSync(mockGenAiPlannerFilePath, 'utf-8');
    expect(generatedGenAiPlannerFile).to.equal(mockGenAiPlannerFile);
  });
});
