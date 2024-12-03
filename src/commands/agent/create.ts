/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Duration, sleep } from '@salesforce/kit';
import { MultiStageOutput } from '@oclif/multi-stage-output';
import { colorize } from '@oclif/core/ux';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.create');

export type AgentCreateResult = {
  isSuccess: boolean;
  errorMessage?: string;
};

// There is no API for this yet. It's being planned/built by the Agent Creator team.
// However, we could possibly use:
//   /services/data/{api-version}/connect/attach-agent-topics

export default class AgentCreate extends SfCommand<AgentCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'job-spec': Flags.file({
      char: 'f',
      required: true,
      summary: messages.getMessage('flags.job-spec.summary'),
      description: messages.getMessage('flags.job-spec.description'),
    }),
    name: Flags.string({
      char: 'n',
      required: true,
      summary: messages.getMessage('flags.name.summary'),
    }),
  };

  public async run(): Promise<AgentCreateResult> {
    const { flags } = await this.parse(AgentCreate);
    const jsonParsingStage = `Parsing ${flags['job-spec']}`;
    const mso = new MultiStageOutput({
      jsonEnabled: this.jsonEnabled(),
      title: `Creating ${flags.name} Agent`,
      stages: [
        jsonParsingStage,
        'Generating GenAiPlanner metadata',
        'Creating agent in org',
        'Retrieving agent metadata',
      ],
    });

    mso.goto(jsonParsingStage);
    await sleep(Duration.milliseconds(200));

    mso.goto('Generating GenAiPlanner metadata');
    await sleep(Duration.milliseconds(200));

    mso.goto('Creating agent in org');

    // POST to /services/data/{api-version}/connect/attach-agent-topics

    // To simulate time spent on the server generating the spec.
    await sleep(Duration.seconds(5));

    mso.goto('Retrieving agent metadata');
    await sleep(Duration.seconds(3));

    mso.stop();

    this.log(
      colorize(
        'green',
        `Successfully created ${flags.name} in ${flags['target-org'].getUsername() ?? 'the target org'}.`
      )
    );
    this.log(`Use ${colorize('dim', `sf org open agent --name ${flags.name}`)} to view the agent in the browser.`);

    return { isSuccess: true };
  }
}
