/*
 * Copyright 2025, Salesforce, Inc.
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

import { resolve, join } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { AuthInfo, Connection, Messages, SfError } from '@salesforce/core';
import React from 'react';
import { render } from 'ink';
import { env } from '@salesforce/kit';
import { AgentPreview as Preview } from '@salesforce/agents';
import { select, confirm, input } from '@inquirer/prompts';
import { AgentPreviewReact } from '../../components/agent-preview-react.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview');

type BotVersionStatus = { Status: 'Active' | 'Inactive' };

export type AgentData = {
  Id: string;
  DeveloperName: string;
  BotVersions: {
    records: BotVersionStatus[];
  };
};

type Choice<Value> = {
  value: Value;
  name?: string;
  disabled?: boolean | string;
};

type AgentValue = {
  Id: string;
  DeveloperName: string;
};

// https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#prerequisites
export const UNSUPPORTED_AGENTS = ['Copilot_for_Salesforce'];

export type AgentPreviewResult = void;
export default class AgentPreview extends SfCommand<AgentPreviewResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly requiresProject = true;
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'client-app': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.client-app.summary'),
      dependsOn: ['target-org'],
    }),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      char: 'd',
    }),
    'apex-debug': Flags.boolean({
      summary: messages.getMessage('flags.apex-debug.summary'),
      char: 'x',
    }),
  };

  public async run(): Promise<AgentPreviewResult> {
    const { flags } = await this.parse(AgentPreview);

    const { 'api-name': apiNameFlag } = flags;
    const conn = flags['target-org'].getConnection(flags['api-version']);

    const authInfo = await AuthInfo.create({
      username: flags['target-org'].getUsername(),
    });
    if (!(flags['client-app'] ?? env.getString('SF_DEMO_AGENT_CLIENT_APP'))) {
      throw new SfError('SF_DEMO_AGENT_CLIENT_APP is unset!');
    }

    const jwtConn = await Connection.create({
      authInfo,
      clientApp: env.getString('SF_DEMO_AGENT_CLIENT_APP') ?? flags['client-app'],
    });

    const agentsQuery = await conn.query<AgentData>(
      'SELECT Id, DeveloperName, (SELECT Status FROM BotVersions) FROM BotDefinition WHERE IsDeleted = false'
    );

    if (agentsQuery.totalSize === 0) throw new SfError('No Agents found in the org');

    const agentsInOrg = agentsQuery.records;

    let selectedAgent;

    if (flags['authoring-bundle']) {
      const envAgentName = env.getString('SF_DEMO_AGENT');
      const agent = agentsQuery.records.find((a) => a.DeveloperName === envAgentName);
      selectedAgent = {
        Id:
          agent?.Id ??
          `Couldn't find an agent in ${agentsQuery.records.map((a) => a.DeveloperName).join(', ')} matching ${
            envAgentName ?? '!SF_DEMO_AGENT is unset!'
          }`,
        DeveloperName: flags['authoring-bundle'],
      };
    } else if (apiNameFlag) {
      selectedAgent = agentsInOrg.find((agent) => agent.DeveloperName === apiNameFlag);
      if (!selectedAgent) throw new Error(`No valid Agents were found with the Api Name ${apiNameFlag}.`);
      validateAgent(selectedAgent);
    } else {
      selectedAgent = await select({
        message: 'Select an agent',
        choices: getAgentChoices(agentsInOrg),
      });
    }

    const outputDir = await resolveOutputDir(flags['output-dir'], flags['apex-debug']);
    const agentPreview = new Preview(jwtConn, selectedAgent.Id);
    agentPreview.toggleApexDebugMode(flags['apex-debug']);

    const instance = render(
      React.createElement(AgentPreviewReact, {
        connection: conn,
        agent: agentPreview,
        name: selectedAgent.DeveloperName,
        outputDir,
      }),
      { exitOnCtrlC: false }
    );
    await instance.waitUntilExit();
  }
}

export const agentIsUnsupported = (devName: string): boolean => UNSUPPORTED_AGENTS.includes(devName);

export const agentIsInactive = (agent: AgentData): boolean =>
  // Agent versioning is not fully supported yet, but this should ensure at least one version is active
  agent.BotVersions.records.every((botVersion) => botVersion.Status === 'Inactive');

export const validateAgent = (agent: AgentData): boolean => {
  // Agents must be active in Agent Builder
  if (agentIsInactive(agent)) {
    throw new SfError(`Agent ${agent.DeveloperName} is inactive.`);
  }
  // The default agent is not supported
  if (agentIsUnsupported(agent.DeveloperName)) {
    throw new SfError(`Agent ${agent.DeveloperName} is not supported.`, 'DefaultAgentNotSupported', [
      'See https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html#prerequisites',
    ]);
  }

  return true;
};

export const getAgentChoices = (agents: AgentData[]): Array<Choice<AgentValue>> =>
  agents.map((agent) => {
    let disabled: string | boolean = false;

    if (agentIsInactive(agent)) disabled = '(Inactive)';
    if (agentIsUnsupported(agent.DeveloperName)) disabled = '(Not Supported)';

    return {
      name: agent.DeveloperName,
      value: {
        Id: agent.Id,
        DeveloperName: agent.DeveloperName,
      },
      disabled,
    };
  });

export const resolveOutputDir = async (
  outputDir: string | undefined,
  apexDebug: boolean | undefined
): Promise<string | undefined> => {
  if (!outputDir) {
    const response = apexDebug
      ? true
      : await confirm({
          message: 'Save transcripts to an output directory?',
          default: true,
        });

    const outputTypes = apexDebug ? 'debug logs and transcripts' : 'transcripts';
    if (response) {
      const getDir = await input({
        message: `Enter the output directory for ${outputTypes}`,
        default: env.getString('SF_AGENT_PREVIEW_OUTPUT_DIR', join('temp', 'agent-preview')),
        required: true,
      });

      return resolve(getDir);
    }
  } else {
    return resolve(outputDir);
  }
};
