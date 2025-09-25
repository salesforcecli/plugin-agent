/*
 * Copyright 2025, Salesforce, Inc.
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
      const err = SfError.wrap(error);
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
