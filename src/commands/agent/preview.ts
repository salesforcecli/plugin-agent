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

import * as path from 'node:path';
import { join, resolve } from 'node:path';
import { globSync } from 'glob';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { AuthInfo, Connection, Lifecycle, Messages, SfError } from '@salesforce/core';
import React from 'react';
import { render } from 'ink';
import {
  AgentPreview as Preview,
  AgentSimulate,
  AgentSource,
  findAuthoringBundle,
  PublishedAgent,
  ScriptAgent,
} from '@salesforce/agents';
import { select } from '@inquirer/prompts';
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
    'use-live-actions': Flags.boolean({
      summary: messages.getMessage('flags.use-live-actions.summary'),
      default: false,
    }),
  };

  public async run(): Promise<AgentPreviewResult> {
    // STAGES OF PREVIEW
    // get user's agent selection either from flags, or interaction
    // if .agent selected, use the AgentSimulate class to preview
    // if published agent, use AgentPreview for preview
    // based on agent, differing auth mechanisms required
    const { flags } = await this.parse(AgentPreview);

    const { 'api-name': apiNameFlag, 'use-live-actions': useLiveActions } = flags;
    const conn = flags['target-org'].getConnection(flags['api-version']);

    const agentsInOrg = (
      await conn.query<AgentData>(
        'SELECT Id, DeveloperName, (SELECT Status FROM BotVersions) FROM BotDefinition WHERE IsDeleted = false'
      )
    ).records;

    let selectedAgent: ScriptAgent | PublishedAgent;

    if (flags['authoring-bundle']) {
      // user specified --authoring-bundle, we'll find the script and use it
      const bundlePath = findAuthoringBundle(this.project!.getPath(), flags['authoring-bundle']);
      if (!bundlePath) {
        throw new SfError(`Could not find authoring bundle for ${flags['authoring-bundle']}`);
      }
      selectedAgent = {
        DeveloperName: flags['authoring-bundle'],
        source: AgentSource.SCRIPT,
        path: join(bundlePath, `${flags['authoring-bundle']}.agent`),
      };
    } else if (apiNameFlag) {
      // user specified --api-name, it should be in the list of agents from the org
      const agent = agentsInOrg.find((a) => a.DeveloperName === apiNameFlag);
      if (!agent) throw new Error(`No valid Agents were found with the Api Name ${apiNameFlag}.`);
      validateAgent(agent);
      selectedAgent = {
        Id: agent.Id,
        DeveloperName: agent.DeveloperName,
        source: AgentSource.PUBLISHED,
      };
      if (!selectedAgent) throw new Error(`No valid Agents were found with the Api Name ${apiNameFlag}.`);
    } else {
      selectedAgent = await select<ScriptAgent | PublishedAgent>({
        message: 'Select an agent',
        choices: this.getAgentChoices(agentsInOrg),
      });
    }

    // we have the selected agent, create the appropriate connection
    const authInfo = await AuthInfo.create({
      username: flags['target-org'].getUsername(),
    });
    // Get client app - check flag first, then auth file, then env var
    let clientApp = flags['client-app'];

    if (!clientApp && selectedAgent?.source === AgentSource.PUBLISHED) {
      const clientApps = getClientAppsFromAuth(authInfo);

      if (clientApps.length === 1) {
        clientApp = clientApps[0];
      } else if (clientApps.length > 1) {
        clientApp = await select({
          message: 'Select a client app',
          choices: clientApps.map((app) => ({ value: app, name: app })),
        });
      } else {
        throw new SfError('No client app found.');
      }
    }

    if (useLiveActions && selectedAgent.source === AgentSource.PUBLISHED) {
      void Lifecycle.getInstance().emitWarning(
        'Published agents will always use real actions in your org, specifying --use-live-actions and selecting a published agent has no effect'
      );
    }

    const jwtConn =
      selectedAgent?.source === AgentSource.PUBLISHED
        ? await Connection.create({
            authInfo,
            clientApp,
          })
        : await Connection.create({ authInfo });

    // Only resolve outputDir if explicitly provided via flag
    // Otherwise, let user decide when exiting
    const outputDir = flags['output-dir'] ? resolve(flags['output-dir']) : undefined;
    // Both classes share the same interface for the methods we need
    const agentPreview =
      selectedAgent.source === AgentSource.PUBLISHED
        ? new Preview(jwtConn, selectedAgent.Id)
        : new AgentSimulate(jwtConn, selectedAgent.path, !useLiveActions);

    agentPreview.setApexDebugMode(flags['apex-debug']);

    const instance = render(
      React.createElement(AgentPreviewReact, {
        connection: conn,
        agent: agentPreview,
        name: selectedAgent.DeveloperName,
        outputDir,
        isLocalAgent: selectedAgent.source === AgentSource.SCRIPT,
        apexDebug: flags['apex-debug'],
      }),
      { exitOnCtrlC: false }
    );
    await instance.waitUntilExit();
  }

  private getAgentChoices(agents: AgentData[]): Array<Choice<ScriptAgent | PublishedAgent>> {
    const choices: Array<Choice<ScriptAgent | PublishedAgent>> = [];

    // Add org agents
    for (const agent of agents) {
      if (agentIsInactive(agent) || agentIsUnsupported(agent.DeveloperName)) {
        continue;
      }

      choices.push({
        name: `${agent.DeveloperName} (Published)`,
        value: {
          Id: agent.Id,
          DeveloperName: agent.DeveloperName,
          source: AgentSource.PUBLISHED,
        },
      });
    }

    // Add local agents from .agent files
    const localAgentPaths = globSync('**/*.agent', { cwd: this.project!.getPath() });
    for (const agentPath of localAgentPaths) {
      const agentName = path.basename(agentPath, '.agent');
      choices.push({
        name: `${agentName} (Agent Script)`,
        value: {
          DeveloperName: agentName,
          source: AgentSource.SCRIPT,
          path: path.join(this.project!.getPath(), agentPath),
        },
      });
    }

    return choices;
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

export const getClientAppsFromAuth = (authInfo: AuthInfo): string[] =>
  Object.keys(authInfo.getFields().clientApps ?? {});
