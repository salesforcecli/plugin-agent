/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Duration, sleep } from '@salesforce/kit';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create.spec');

export type AgentCreateSpecResult = {
  isSuccess: boolean;
  errorMessage?: string;
  jobSpec?: string; // the location of the job spec file
  // We probably need more than this in the returned JSON like
  // all the parameters used to generate the spec and the spec contents
};

// This is a GET of '/services/data/v62.0/connect/agent-job-spec?agentType...

// Mocked job spec, which is a list of AI generated jobs to be done
const jobSpecContent = [
  {
    jobTitle: 'My first job title',
    jobDescription: 'This is what the first job does',
  },
  {
    jobTitle: 'My second job title',
    jobDescription: 'This is what the second job does',
  },
  {
    jobTitle: 'My third job title',
    jobDescription: 'This is what the third job does',
  },
];

export default class AgentCreateSpec extends SfCommand<AgentCreateSpecResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    name: Flags.string({
      char: 'n',
      required: true,
      summary: messages.getMessage('flags.name.summary'),
    }),
    type: Flags.string({
      char: 't',
      required: true,
      summary: messages.getMessage('flags.type.summary'),
      options: ['customer_facing', 'employee_facing'],
    }),
    role: Flags.string({
      required: true,
      summary: messages.getMessage('flags.role.summary'),
    }),
    'company-name': Flags.string({
      required: true,
      summary: messages.getMessage('flags.company-name.summary'),
    }),
    'company-description': Flags.string({
      required: true,
      summary: messages.getMessage('flags.company-description.summary'),
    }),
    'company-website': Flags.string({
      summary: messages.getMessage('flags.company-website.summary'),
    }),
    'output-dir': Flags.directory({
      char: 'd',
      exists: true,
      summary: messages.getMessage('flags.output-dir.summary'),
      default: 'config',
    }),
  };

  public async run(): Promise<AgentCreateSpecResult> {
    const { flags } = await this.parse(AgentCreateSpec);

    // We'll need to generate a GenAiPlanner using the name flag and deploy it
    // as part of this, at least for now. We won't have to do this with the
    // new API being created for us.

    this.log();
    this.styledHeader('Agent Details');
    this.log('Name:', flags.name);
    this.log('Type:', flags.type);
    this.log('Role:', flags.role);
    this.log('Company Name:', flags['company-name']);
    this.log('Company Description:', flags['company-description']);
    if (flags['company-website']) {
      this.log('Company Website:', flags['company-website']);
    }

    this.log();
    this.spinner.start('Creating agent spec');

    // To simulate time spent on the server generating the spec.
    await sleep(Duration.seconds(2));

    // GET to /services/data/{api-version}/connect/agent-job-spec

    // Write a file with the returned job specs
    const filePath = join(flags['output-dir'], 'agentSpec.json');
    writeFileSync(filePath, JSON.stringify(jobSpecContent, null, 4));

    this.spinner.stop();

    this.log(`\nSaved agent spec: ${filePath}`);

    return {
      isSuccess: true,
      jobSpec: filePath,
    };
  }
}
