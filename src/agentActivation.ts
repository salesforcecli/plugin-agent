/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, Messages, Org, SfError } from '@salesforce/core';
import { Agent, type BotMetadata } from '@salesforce/agents';
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
  conn: Connection;
  targetOrg: Org;
  status: 'Active' | 'Inactive';
  apiNameFlag?: string;
}): Promise<Agent> => {
  const { conn, targetOrg, status, apiNameFlag } = config;

  let agentsInOrg: BotMetadata[] = [];
  try {
    agentsInOrg = await Agent.listRemote(conn);
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

  return new Agent({ connection: conn, nameOrId: selectedAgent!.Id });
};
