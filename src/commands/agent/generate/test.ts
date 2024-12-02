/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.generate.test');

export type AgentGenerateTestResult = {
  path: string;
};

export default class AgentGenerateTest extends SfCommand<AgentGenerateTestResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly state = 'beta';

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: false,
    }),
  };

  public async run(): Promise<AgentGenerateTestResult> {
    const { flags } = await this.parse(AgentGenerateTest);

    const name = flags.name ?? 'world';
    this.log(`hello ${name} from src/commands/agent/generate/test.ts`);
    return {
      path: 'src/commands/agent/generate/test.ts',
    };
  }
}
