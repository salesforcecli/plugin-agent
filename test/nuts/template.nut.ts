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
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentGenerateTemplateResult } from '../../src/commands/agent/generate/template.js';
import { getTestSession } from './shared-setup.js';

describe('agent generate template NUTs', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    await getTestSession();
  });

  it('throws an error if Bot "type" is equal to "Bot"', async () => {
    const agentVersion = 1;
    const agentFile = join('force-app', 'main', 'default', 'bots', 'Bot_Agent', 'Bot_Agent.bot-meta.xml');
    const outputDir = 'force-app/main/default';
    const command = `agent generate template --agent-version ${agentVersion} --agent-file "${agentFile}" --output-dir ${outputDir} --json`;
    const output = execCmd<AgentGenerateTemplateResult>(command, { ensureExitCode: 1 }).jsonOutput;

    expect(output?.message).to.include(
      "The 'type' attribute of this Bot metadata component XML file can't have a value of 'Bot'"
    );
  });
});
