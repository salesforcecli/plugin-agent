/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import React from 'react';
import { render } from 'ink';
import { AgentPreview as Preview } from '@salesforce/agents';
import { select } from '@inquirer/prompts';
import { AgentPreviewReact } from '../../components/agent-preview-react.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview');

type AgentQuery = {
  Id: string;
  MasterLabel: string;
};

export type AgentPreviewResult = void;
export default class AgentPreview extends SfCommand<AgentPreviewResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false;
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      exclusive: ['id'],
    }),
    id: Flags.salesforceId({
      summary: messages.getMessage('flags.id.summary'),
      char: 'i',
      length: 'both',
      startsWith: '0Xx',
      exclusive: ['name'],
    }),
  };

  public async run(): Promise<AgentPreviewResult> {
    const { flags } = await this.parse(AgentPreview);

    const { id, name, 'target-org': org } = flags;
    const conn = org.getConnection(flags['api-version']);

    let agent;

    if (name ?? id) {
      try {
        const where = name ? `MasterLabel='${!name}'` : `Id='${!id}'`;
        agent = await conn.singleRecordQuery<AgentQuery>(`SELECT Id, MasterLabel FROM BotDefinition WHERE ${where}`);
      } catch (err) {
        const error = err as SfError;

        if (error.name === 'SingleRecordQuery_NoRecords') {
          const type = name ? `name "${!name}"` : `id "${!id}"`;
          this.warn(`No Agents were found with the ${type}. Searching org for Agents...`);
          this.log('');
        } else {
          throw error;
        }
      }
    }

    if (!agent?.Id) {
      // TODO: Find a way to only return active agents
      const agents = await conn.query<AgentQuery>('SELECT Id, MasterLabel from BotDefinition LIMIT 100');

      const agentsInOrg = agents.records.map((agentInOrg) => ({
        name: agentInOrg.MasterLabel,
        value: {
          Id: agentInOrg.Id,
          MasterLabel: agentInOrg.MasterLabel,
        },
      }));

      agent = await select({
        message: 'Select an agent',
        choices: agentsInOrg,
      });
    }

    if (!agent?.Id) {
      throw new SfError('No Agent selected');
    }

    const agentPreview = new Preview(conn);
    const instance = render(
      React.createElement(AgentPreviewReact, { agent: agentPreview, id: agent.Id, name: agent.MasterLabel })
    );
    await instance.waitUntilExit();
  }
}
