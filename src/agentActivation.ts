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

import { Messages, Org, SfError, SfProject } from '@salesforce/core';
import { Agent, type BotMetadata, ProductionAgent } from '@salesforce/agents';
import { select } from '@inquirer/prompts';

type Choice<Value> = {
  value: Value;
  name?: string;
  disabled?: boolean | string;
};
type AgentValue = {
  Id: string;
  DeveloperName: string;
};

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.activation');

export const UNSUPPORTED_AGENTS = ['Copilot_for_Salesforce'];
export const agentIsUnsupported = (devName: string): boolean => UNSUPPORTED_AGENTS.includes(devName);

export const validateAgent = (agent: BotMetadata): boolean => {
  if (agent.IsDeleted) {
    throw messages.createError('error.agentIsDeleted', [agent.DeveloperName]);
  }
  if (agentIsUnsupported(agent.DeveloperName)) {
    throw messages.createError('error.agentIsDefault', [agent.DeveloperName]);
  }
  return true;
};

export const getAgentChoices = (agents: BotMetadata[], status: 'Active' | 'Inactive'): Array<Choice<AgentValue>> =>
  agents.map((agent) => {
    let disabled: string | boolean = false;

    const lastBotVersion = agent.BotVersions.records[agent.BotVersions.records.length - 1];
    if (lastBotVersion.Status === status) {
      disabled = `(Already ${status})`;
    }
    if (agentIsUnsupported(agent.DeveloperName)) {
      disabled = '(Not Supported)';
    }

    return {
      name: agent.DeveloperName,
      value: {
        Id: agent.Id,
        DeveloperName: agent.DeveloperName,
      },
      disabled,
    };
  });

export const getAgentForActivation = async (config: {
  targetOrg: Org;
  status: 'Active' | 'Inactive';
  apiNameFlag?: string;
}): Promise<ProductionAgent> => {
  const { targetOrg, status, apiNameFlag } = config;

  let agentsInOrg: BotMetadata[] = [];
  try {
    agentsInOrg = await Agent.listRemote(targetOrg.getConnection());
  } catch (error) {
    throw SfError.create({
      message: 'Error listing agents in org',
      name: 'NoAgentsInOrgError',
      cause: error,
    });
  }

  if (!agentsInOrg.length) {
    throw messages.createError('error.noAgentsInOrg', [targetOrg.getUsername()]);
  }

  let selectedAgent: BotMetadata | undefined;

  if (apiNameFlag) {
    selectedAgent = agentsInOrg.find((agent) => agent.DeveloperName === apiNameFlag);
    if (!selectedAgent) {
      throw messages.createError('error.missingAgentInOrg', [apiNameFlag, targetOrg.getUsername()]);
    }
    validateAgent(selectedAgent);
  } else {
    const agentChoice = await select({
      message: 'Select an agent',
      choices: getAgentChoices(agentsInOrg, status),
    });
    selectedAgent = agentsInOrg.find((agent) => agent.DeveloperName === agentChoice.DeveloperName);
  }

  return Agent.init({
    connection: targetOrg.getConnection(),
    apiNameOrId: selectedAgent!.Id,
    project: SfProject.getInstance(),
  });
};
