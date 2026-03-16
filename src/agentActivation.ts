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
import { Agent, type BotMetadata, type BotVersionMetadata, ProductionAgent } from '@salesforce/agents';
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

type VersionChoice = {
  version: number;
  status: string;
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
  agents
    .filter((agent) => {
      // Only one version can be active at a time
      // For activate (status='Active'): show agents that don't have an active version (all versions are inactive)
      // For deactivate (status='Inactive'): show agents that have an active version
      const hasActiveVersion = agent.BotVersions.records.some((version) => version.Status === 'Active');
      const canPerformOperation = status === 'Active' ? !hasActiveVersion : hasActiveVersion;
      // Filter out agents that can't perform the operation or are unsupported
      return canPerformOperation && !agentIsUnsupported(agent.DeveloperName);
    })
    .sort((a, b) => a.DeveloperName.localeCompare(b.DeveloperName))
    .map((agent) => ({
      name: agent.DeveloperName,
      value: {
        Id: agent.Id,
        DeveloperName: agent.DeveloperName,
      },
    }));

export const getVersionChoices = (
  versions: BotVersionMetadata[],
  status: 'Active' | 'Inactive'
): Array<Choice<VersionChoice>> =>
  versions
    .sort((a, b) => b.VersionNumber - a.VersionNumber)
    .map((version) => {
      const isTargetStatus = version.Status === status;
      return {
        name: `Version ${version.VersionNumber}`,
        value: {
          version: version.VersionNumber,
          status: version.Status,
        },
        disabled: isTargetStatus ? `(Already ${status})` : false,
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

export const getVersionForActivation = async (config: {
  agent: ProductionAgent;
  status: 'Active' | 'Inactive';
  versionFlag?: number;
  jsonEnabled?: boolean;
}): Promise<{ version: number | undefined; warning?: string }> => {
  const { agent, status, versionFlag, jsonEnabled } = config;

  // If version flag is provided, return it
  if (versionFlag !== undefined) {
    return { version: versionFlag };
  }

  // Get bot metadata to access versions
  const botMetadata = await agent.getBotMetadata();
  // Filter out deleted versions as a defensive measure
  const versions = botMetadata.BotVersions.records.filter((v) => !v.IsDeleted);

  // If there's only one version, return it
  if (versions.length === 1) {
    return { version: versions[0].VersionNumber };
  }

  // Get version choices and filter out disabled ones
  const choices = getVersionChoices(versions, status);
  const availableChoices = choices.filter((choice) => !choice.disabled);

  // If there's only one available choice, return it automatically
  if (availableChoices.length === 1) {
    return { version: availableChoices[0].value.version };
  }

  // If no versions are available, throw an error
  if (availableChoices.length === 0) {
    const action = status === 'Active' ? 'activate' : 'deactivate';
    throw messages.createError('error.noVersionsAvailable', [action]);
  }

  // If JSON mode is enabled, automatically select the latest available version
  if (jsonEnabled) {
    // Find the latest (highest version number) available version
    const latestVersion = availableChoices.reduce((latest, choice) =>
      choice.value.version > latest.value.version ? choice : latest
    );
    return {
      version: latestVersion.value.version,
      warning: `No version specified, automatically selected latest available version: ${latestVersion.value.version}`,
    };
  }

  // Prompt user to select a version
  const versionChoice = await select({
    message: 'Select a version',
    choices,
  });

  return { version: versionChoice.version };
};
