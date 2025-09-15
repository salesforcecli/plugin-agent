/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Agent } from '@salesforce/agents';

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
    const bundlePath = resolve(flags['api-name']);

    // Validate bundle path exists
    if (!existsSync(bundlePath)) {
      throw messages.createError('error.invalidBundlePath');
    }

    try {
      const targetOrg = flags['target-org'];
      const conn = targetOrg.getConnection(flags['api-version']);
      // Call Agent.compileAfScript() API
      await Agent.compileAfScript(conn, bundlePath);
      this.log('Successfully compiled');
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
