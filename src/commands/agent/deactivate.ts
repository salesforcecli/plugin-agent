/*
 * Copyright 2026, Salesforce, Inc.
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
import { SfCommand, Flags, toHelpSection } from '@salesforce/sf-plugins-core';
import { Messages, SfError, Lifecycle, EnvironmentVariable } from '@salesforce/core';
import { getAgentForActivation } from '../../agentActivation.js';
import { AgentActivateResult } from './activate.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.deactivate');

export default class AgentDeactivate extends SfCommand<AgentActivateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static enableJsonFlag = true;

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Agent deactivated successfully.',
    'NotFound (2)': 'Agent not found in the org.',
    'DeactivationFailed (4)': 'Failed to deactivate the agent due to API or network errors.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
    }),
  };

  public async run(): Promise<AgentActivateResult> {
    const { flags } = await this.parse(AgentDeactivate);

    const apiNameFlag = flags['api-name'];
    const targetOrg = flags['target-org'];

    if (!apiNameFlag && this.jsonEnabled()) {
      throw messages.createError('error.missingRequiredFlags', ['api-name']);
    }

    // Get agent with error tracking
    let agent;
    try {
      agent = await getAgentForActivation({ targetOrg, status: 'Inactive', apiNameFlag });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      if (wrapped.message.toLowerCase().includes('not found') || wrapped.message.toLowerCase().includes('no agent')) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_deactivate_agent_not_found' });
        throw new SfError(
          messages.getMessage('error.agentNotFound', [apiNameFlag ?? 'unknown']),
          'AgentNotFound',
          [],
          2,
          wrapped
        );
      }
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_deactivate_get_agent_failed' });
      throw wrapped;
    }

    // Deactivate with error tracking
    let result;
    try {
      result = await agent.deactivate();
    } catch (error) {
      const wrapped = SfError.wrap(error);
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_deactivate_failed' });
      throw new SfError(
        messages.getMessage('error.deactivationFailed', [wrapped.message]),
        'DeactivationFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

    const metadata = await agent.getBotMetadata();
    await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_deactivate_success' });

    this.log(`${metadata.DeveloperName} v${result.VersionNumber} deactivated.`);
    return { success: true, version: result.VersionNumber };
  }
}
