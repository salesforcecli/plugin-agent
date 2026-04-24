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

import { Flags, SfCommand, toHelpSection } from '@salesforce/sf-plugins-core';
import { EnvironmentVariable, Lifecycle, Messages, SfError } from '@salesforce/core';
import { Agent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import { createCache } from '../../../previewSessionStore.js';
import { COMPILATION_API_EXIT_CODES } from '../../../common.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview.start');

export type AgentPreviewStartResult = {
  sessionId: string;
  agentApiName: string;
};

export default class AgentPreviewStart extends SfCommand<AgentPreviewStartResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Preview session started successfully.',
    'Failed (1)': 'Agent Script compilation failed (syntax errors in the script).',
    'NotFound (2)':
      'Agent not found, or compilation API returned HTTP 404 (endpoint may not be available in your org or region).',
    'ServerError (3)': 'Compilation API returned HTTP 500 (server error during compilation).',
    'PreviewStartFailed (4)': 'Preview session failed to start due to API or network errors.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
      exactlyOne: ['api-name', 'authoring-bundle'],
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      exactlyOne: ['api-name', 'authoring-bundle'],
    }),
    'use-live-actions': Flags.boolean({
      summary: messages.getMessage('flags.use-live-actions.summary'),
      exclusive: ['simulate-actions'],
    }),
    'simulate-actions': Flags.boolean({
      summary: messages.getMessage('flags.simulate-actions.summary'),
      exclusive: ['use-live-actions'],
    }),
  };

  public async run(): Promise<AgentPreviewStartResult> {
    const { flags } = await this.parse(AgentPreviewStart);

    // Validate: authoring-bundle requires exactly one mode flag
    // (mutual exclusion of mode flags handled by 'exclusive' in flag definitions)
    if (flags['authoring-bundle'] && !flags['use-live-actions'] && !flags['simulate-actions']) {
      throw new SfError(
        'When using --authoring-bundle, you must specify either --use-live-actions or --simulate-actions.',
        'MissingModeFlag'
      );
    }

    const conn = flags['target-org'].getConnection(flags['api-version']);
    const useLiveActions = flags['use-live-actions'];
    const simulateActions = flags['simulate-actions'];
    const agentIdentifier = flags['authoring-bundle'] ?? flags['api-name']!;

    // Track telemetry for agent initialization
    let agent;
    try {
      agent = flags['authoring-bundle']
        ? await Agent.init({ connection: conn, project: this.project!, aabName: flags['authoring-bundle'] })
        : await Agent.init({ connection: conn, project: this.project!, apiNameOrId: flags['api-name']! });
    } catch (error) {
      const wrapped = SfError.wrap(error);

      // Check for agent not found errors
      if (wrapped.message.toLowerCase().includes('not found') || wrapped.code === 'ENOENT') {
        const notFoundError = new SfError(
          messages.getMessage('error.agentNotFound', [agentIdentifier]),
          'AgentNotFound',
          [],
          2
        );
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_agent_not_found' });
        throw notFoundError;
      }

      // Check for compilation API errors (404/500 handled by @salesforce/agents)
      if (wrapped.exitCode === COMPILATION_API_EXIT_CODES.NOT_FOUND) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_compilation_not_found' });
        throw wrapped;
      }
      if (wrapped.exitCode === COMPILATION_API_EXIT_CODES.SERVER_ERROR) {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_compilation_server_error' });
        throw wrapped;
      }

      // Check for compilation failure (exit code 1)
      if (wrapped.exitCode === 1 && wrapped.name === 'CompileAgentScriptError') {
        await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_compilation_failed' });
        throw wrapped;
      }

      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_agent_init_failed' });
      throw wrapped;
    }

    // Set mode for authoring bundles based on which flag was specified
    // (mutual exclusion enforced by flag definitions - can't have both)
    if (agent instanceof ScriptAgent) {
      agent.preview.setMockMode(simulateActions ? 'Mock' : 'Live Test');
    }

    // Warn if mode flags are used with published agents (they have no effect)
    if (agent instanceof ProductionAgent && (useLiveActions || simulateActions)) {
      void Lifecycle.getInstance().emitWarning(
        'Published agents always use real actions; --use-live-actions and --simulate-actions have no effect for published agents.'
      );
    }

    // Track telemetry for preview start
    let session;
    try {
      session = await agent.preview.start();
    } catch (error) {
      const wrapped = SfError.wrap(error);
      await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_failed' });
      throw new SfError(
        messages.getMessage('error.previewStartFailed', [wrapped.message]),
        'PreviewStartFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

    const displayName = flags['authoring-bundle'] ?? flags['api-name'];
    await createCache(agent, { displayName });

    await Lifecycle.getInstance().emitTelemetry({ eventName: 'agent_preview_start_success' });
    const result: AgentPreviewStartResult = { sessionId: session.sessionId, agentApiName: agentIdentifier };
    this.log(messages.getMessage('output.sessionId', [session.sessionId]));
    return result;
  }
}
