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
import { existsSync } from 'node:fs';
import { expect } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { AgentGenerateTemplateResult } from '../../src/commands/agent/generate/template.js';

describe('agent generate template NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should generate template from agent file', () => {
    const agentFile = join(
      session.project.dir,
      'force-app',
      'main',
      'default',
      'bots',
      'Local_Info_Agent',
      'Local_Info_Agent.bot-meta.xml'
    );
    const agentVersion = 1;

    const result = execCmd<AgentGenerateTemplateResult>(
      `agent generate template --agent-file ${agentFile} --agent-version ${agentVersion} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.genAiPlannerBundlePath).to.be.ok;
    expect(result?.botTemplatePath).to.be.ok;

    // Verify files exist
    expect(existsSync(result!.genAiPlannerBundlePath)).to.be.true;
    expect(existsSync(result!.botTemplatePath)).to.be.true;
  });

  it('should fail for invalid agent file', () => {
    const invalidAgentFile = join(session.project.dir, 'invalid', 'agent.bot-meta.xml');
    const agentVersion = 1;

    execCmd<AgentGenerateTemplateResult>(
      `agent generate template --agent-file ${invalidAgentFile} --agent-version ${agentVersion} --json`,
      { ensureExitCode: 1 }
    );
  });

  it('should fail for non-bot-meta.xml file', () => {
    const invalidFile = join(
      session.project.dir,
      'force-app',
      'main',
      'default',
      'bots',
      'Local_Info_Agent',
      'v1.botVersion-meta.xml'
    );
    const agentVersion = 1;

    execCmd<AgentGenerateTemplateResult>(
      `agent generate template --agent-file ${invalidFile} --agent-version ${agentVersion} --json`,
      { ensureExitCode: 1 }
    );
  });
});
