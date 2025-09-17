/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { Agent, findAuthoringBundle } from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.validate.authoring-bundle');

export type AgentValidateAuthoringBundleResult = {
  success: boolean;
  errors?: string[];
};

export default class AgentValidateAuthoringBundle extends SfCommand<AgentValidateAuthoringBundleResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;
  public static state = 'beta';

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.api-name.summary'),
      required: true,
    }),
  };

  public async run(): Promise<AgentValidateAuthoringBundleResult> {
    const { flags } = await this.parse(AgentValidateAuthoringBundle);
    // todo: this eslint warning can be removed once published
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const authoringBundleDir = findAuthoringBundle(this.project!.getPath(), flags['api-name']);
    if (!authoringBundleDir) {
      throw new SfError(messages.getMessage('error.afscriptNotFound', [flags['api-name']]), 'AfScriptNotFoundError', [
        messages.getMessage('error.afscriptNotFoundAction'),
      ]);
    }

    try {
      const targetOrg = flags['target-org'];
      const conn = targetOrg.getConnection(flags['api-version']);
      // Call Agent.compileAfScript() API
      await Agent.compileAfScript(
        conn,
        readFileSync(join(authoringBundleDir, `${flags['api-name']}.afscript`), 'utf8')
      );
      this.logSuccess('Successfully compiled');
      return {
        success: true,
      };
    } catch (error) {
      // Handle validation errors
      const err = error instanceof Error ? error : new Error(String(error));
      const formattedError = err.message
        .split('\n')
        .map((line) => `- ${line}`)
        .join('\n');
      this.error(messages.getMessage('error.compilationFailed', [formattedError]));

      return {
        success: false,
        errors: err.message.split('\n'),
      };
    }
  }
}
