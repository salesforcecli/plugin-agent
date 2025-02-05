/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.template');

export type AgentGenerateTemplateResult = {
  path: string;
};

export default class AgentGenerateTemplate extends SfCommand<AgentGenerateTemplateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'beta';
  public static readonly requiresProject = true;

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'agent-api-name': Flags.string({
      summary: messages.getMessage('flags.agent-api-name.summary'),
      required: true,
    }),
    'output-dir': Flags.directory({
      char: 'd',
      exists: true,
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
  };

  public async run(): Promise<AgentGenerateTemplateResult> {
    const { flags } = await this.parse(AgentGenerateTemplate);

    // TODO: look for a Bot with the agent API name
    const botName = flags['agent-api-name'];
    const outputDir = flags['output-dir'] ? resolve(flags['output-dir']) : this.project?.getDefaultPackage().fullPath;

    const agentTemplateFilePath = join(outputDir as string, 'agentTemplates', `${botName}.agentTemplate-meta.xml`);
    mkdirSync(dirname(agentTemplateFilePath), { recursive: true });

    writeFileSync(agentTemplateFilePath, xmlContent);

    this.log(`\nSaved agent template: ${agentTemplateFilePath}`);

    return { path: agentTemplateFilePath };
  }
}

const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<AgentTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
</AgentTemplate>
`;
