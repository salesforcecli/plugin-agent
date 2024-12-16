/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Lifecycle, Messages } from '@salesforce/core';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { colorize } from '@oclif/core/ux';
import { Agent, AgentCreateConfig, AgentCreateLifecycleStages } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create');

export type AgentCreateResult = {
  isSuccess: boolean;
  errorMessage?: string;
};

export default class AgentCreate extends SfCommand<AgentCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    spec: Flags.file({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.spec.summary'),
    }),
    name: Flags.string({
      char: 'n',
      required: true,
      summary: messages.getMessage('flags.name.summary'),
    }),
  };

  public async run(): Promise<AgentCreateResult> {
    const { flags } = await this.parse(AgentCreate);
    const jsonParsingStage = `Parsing ${flags.spec}`;
    const mso = new MultiStageOutput({
      jsonEnabled: this.jsonEnabled(),
      title: `Creating ${flags.name} Agent`,
      stages: [
        jsonParsingStage,
        'Generating local metadata',
        'Deploying metadata to org',
        'Creating Agent in org',
        'Retrieving Agent metadata',
      ],
    });

    mso.goto(jsonParsingStage);
    const agentConfig = {
      ...(JSON.parse(fs.readFileSync(flags.spec, 'utf8')) as AgentCreateConfig),
      name: flags.name,
    };

    // @ts-expect-error not using async method in callback
    Lifecycle.getInstance().on(AgentCreateLifecycleStages.CreatingLocally, () => mso.goto('Generating local metadata'));
    Lifecycle.getInstance().on(AgentCreateLifecycleStages.DeployingMetadata, () =>
      // @ts-expect-error not using async method in callback
      mso.goto('Deploying metadata to org')
    );
    // @ts-expect-error not using async method in callback
    Lifecycle.getInstance().on(AgentCreateLifecycleStages.CreatingRemotely, () => mso.goto('Creating Agent in org'));
    Lifecycle.getInstance().on(AgentCreateLifecycleStages.RetrievingMetadata, () =>
      // @ts-expect-error not using async method in callback
      mso.goto('Retrieving Agent metadata')
    );

    const agent = new Agent(flags['target-org'].getConnection(flags['api-version']), this.project!);
    const created = await agent.create(agentConfig);

    mso.stop();

    this.log(
      created.isSuccess
        ? colorize(
            'green',
            `Successfully created ${flags.name} in ${flags['target-org'].getUsername() ?? 'the target org'}.`
          )
        : colorize('red', `failed to create agent ${flags.name}: ${created.errorMessage ?? ''}`)
    );
    this.log(`Use ${colorize('dim', `sf org open agent --name ${flags.name}`)} to view the agent in the browser.`);

    return { isSuccess: created.isSuccess };
  }
}
