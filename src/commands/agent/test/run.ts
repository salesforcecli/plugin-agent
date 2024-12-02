/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

export type AgentTestRunResult = {
  jobId: string; // AiEvaluation.Id
  success: boolean;
  errorCode?: string;
  message?: string;
};

export default class AgentTestRun extends SfCommand<AgentTestRunResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    // AiEvalDefinitionVersion.Id -- This should really be "test-name"
    id: Flags.string({
      char: 'i',
      required: true,
      summary: messages.getMessage('flags.id.summary'),
      description: messages.getMessage('flags.id.description'),
    }),
    wait: Flags.duration({
      char: 'w',
      unit: 'minutes',
      min: 1,
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
    }),
    //
    // Future flags:
    //   result-format [csv, json, table, junit, TAP]
    //   suites [array of suite names]
    //   verbose [boolean]
    //   ??? api-version or build-version ???
  };

  public async run(): Promise<AgentTestRunResult> {
    const { flags } = await this.parse(AgentTestRun);

    this.log(`Starting tests for AiEvalDefinitionVersion: ${flags.id}`);

    // Call SF Eval Connect API passing AiEvalDefinitionVersion.Id
    // POST to /einstein/ai-evaluations/{aiEvalDefinitionVersionId}/start

    // Returns: AiEvaluation.Id

    return {
      success: true,
      jobId: '4KBSM000000003F4AQ', // AiEvaluation.Id; needed for getting status and stopping
    };
  }
}
