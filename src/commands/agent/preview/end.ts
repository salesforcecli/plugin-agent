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

import { Flags, SfCommand, toHelpSection, prompts } from '@salesforce/sf-plugins-core';
import { Messages, SfError, EnvironmentVariable } from '@salesforce/core';
import { Agent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import type { Connection } from '@salesforce/core';
import type { Interfaces } from '@oclif/core';
import {
  getCachedSessionIds,
  listCachedSessions,
  removeCache,
  validatePreviewSession,
  type CachedPreviewSessionEntry,
} from '../../../previewSessionStore.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.preview.end');

async function callPreviewEnd(agent: ScriptAgent | ProductionAgent): Promise<void> {
  if (agent instanceof ScriptAgent) {
    await agent.preview.end();
  } else if (agent instanceof ProductionAgent) {
    await agent.preview.end('UserRequest');
  }
}

export type EndedSession = {
  sessionId: string;
  tracesPath: string;
};

export type AgentPreviewEndResult = { ended: EndedSession[] } | EndedSession;

type SessionTask = { sessionId: string };

export default class AgentPreviewEnd extends SfCommand<AgentPreviewEndResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Preview session ended successfully and traces saved.',
    'ExactlyOneRequired (2)':
      'Neither --api-name nor --authoring-bundle was provided (required when --all is not set).',
    'NotFound (2)': 'Agent not found, or no preview session exists for this agent.',
    'PreviewEndFailed (4)': 'Failed to end the preview session.',
    'PreviewEndPartialFailure (68)': 'With --all, one or more sessions failed to end while others succeeded.',
    'SessionAmbiguous (5)': 'Multiple preview sessions found; specify --session-id to choose one.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
      required: false,
      exclusive: ['all'],
    }),
    'api-name': Flags.string({
      summary: messages.getMessage('flags.api-name.summary'),
      char: 'n',
      exclusive: ['authoring-bundle'],
    }),
    'authoring-bundle': Flags.string({
      summary: messages.getMessage('flags.authoring-bundle.summary'),
      exclusive: ['api-name'],
    }),
    all: Flags.boolean({
      summary: messages.getMessage('flags.all.summary'),
      exclusive: ['session-id'],
    }),
    'no-prompt': Flags.boolean({
      summary: messages.getMessage('flags.no-prompt.summary'),
      char: 'p',
    }),
  };

  public async run(): Promise<AgentPreviewEndResult> {
    const { flags } = await this.parse(AgentPreviewEnd);

    const conn = flags['target-org'].getConnection(flags['api-version']);

    if (flags['all']) {
      return this.endAll(flags, conn);
    }

    // Without --all, exactly one of --api-name or --authoring-bundle is required.
    if (!flags['api-name'] && !flags['authoring-bundle']) {
      throw new SfError(messages.getMessage('error.exactlyOneRequired'), 'ExactlyOneRequired', [], 2);
    }

    const agent = await this.initAgent(flags, conn);

    let sessionId = flags['session-id'];
    if (sessionId === undefined) {
      const cached = await getCachedSessionIds(this.project!, agent);
      if (cached.length === 0) {
        throw new SfError(messages.getMessage('error.noSession'), 'PreviewSessionNotFound', [], 2);
      }
      if (cached.length > 1) {
        throw new SfError(
          messages.getMessage('error.multipleSessions', [cached.join(', ')]),
          'PreviewSessionAmbiguous',
          [],
          5
        );
      }
      sessionId = cached[0];
    }

    agent.setSessionId(sessionId);

    try {
      await validatePreviewSession(agent);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.sessionInvalid', [sessionId]),
        'PreviewSessionInvalid',
        [],
        2,
        wrapped
      );
    }

    const tracesPath = await agent.getHistoryDir();
    await removeCache(agent);

    try {
      await callPreviewEnd(agent);
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(
        messages.getMessage('error.endFailed', [wrapped.message]),
        'PreviewEndFailed',
        [wrapped.message],
        4,
        wrapped
      );
    }

    const result: EndedSession = { sessionId, tracesPath };
    this.log(messages.getMessage('output.tracesPath', [tracesPath]));
    return result;
  }

  private async initAgent(
    flags: Pick<CommandFlags, 'api-name' | 'authoring-bundle'>,
    conn: Connection
  ): Promise<ScriptAgent | ProductionAgent> {
    const agentIdentifier = flags['authoring-bundle'] ?? flags['api-name']!;
    try {
      return flags['authoring-bundle']
        ? await Agent.init({
            connection: conn,
            project: this.project!,
            aabName: flags['authoring-bundle'],
          })
        : await Agent.init({ connection: conn, project: this.project!, apiNameOrId: flags['api-name']! });
    } catch (error) {
      const wrapped = SfError.wrap(error);
      throw new SfError(messages.getMessage('error.agentNotFound', [agentIdentifier]), 'AgentNotFound', [], 2, wrapped);
    }
  }

  private async endAll(
    flags: Pick<CommandFlags, 'api-name' | 'authoring-bundle' | 'no-prompt'>,
    conn: Connection
  ): Promise<{ ended: EndedSession[] }> {
    const hasAgentIdentifier = flags['api-name'] !== undefined || flags['authoring-bundle'] !== undefined;

    if (hasAgentIdentifier) {
      return this.endAllForAgent(flags, conn);
    }
    return this.endAllAgents(conn, flags['no-prompt'] ?? false);
  }

  /**
   * Path 1: --all + --api-name or --authoring-bundle
   * Ends all sessions for a single specified agent. This is the original behaviour.
   */
  private async endAllForAgent(
    flags: Pick<CommandFlags, 'api-name' | 'authoring-bundle' | 'no-prompt'>,
    conn: Connection
  ): Promise<{ ended: EndedSession[] }> {
    const agent = await this.initAgent(flags, conn);
    const agentLabel = flags['api-name'] ?? flags['authoring-bundle']!;
    const sessionIds = await getCachedSessionIds(this.project!, agent);
    const sessionsToEnd: SessionTask[] = sessionIds.map((sessionId) => ({ sessionId }));

    if (sessionsToEnd.length === 0) {
      this.log(messages.getMessage('output.noSessionsFound'));
      return { ended: [] };
    }

    if (!flags['no-prompt']) {
      const confirmed = await prompts.confirm({
        message: messages.getMessage('prompt.confirmAll', [sessionsToEnd.length, agentLabel]),
      });
      if (!confirmed) {
        return { ended: [] };
      }
    }

    const { ended, failed } = await endSessionsForAgent(agent, sessionsToEnd);
    return this.finishEndAll(ended, failed);
  }

  /**
   * Path 2: --all alone (no agent identifier).
   * Reads all agents from the local cache via listCachedSessions and ends every session.
   * sessionType 'published' → ProductionAgent (server-side DELETE). 'simulated'/'live' → ScriptAgent (local only).
   * session-meta.json is always present for entries returned by listCachedSessions, so sessionType is always defined.
   */
  private async endAllAgents(conn: Connection, noPrompt: boolean): Promise<{ ended: EndedSession[] }> {
    const entries: CachedPreviewSessionEntry[] = await listCachedSessions(this.project!);

    const totalSessions = entries.reduce((sum, e) => sum + e.sessions.length, 0);

    if (totalSessions === 0) {
      this.log(messages.getMessage('output.noSessionsFound'));
      return { ended: [] };
    }

    if (!noPrompt) {
      const agentBreakdown = entries
        .map((e) => {
          const label = e.displayName ?? e.agentId;
          const type = e.sessions[0]?.sessionType === 'published' ? 'bot' : 'bundle'; // 'bot'/'bundle' labels confirmed by PM — intentional deviation from raw sessionType value
          return `  - ${label} (${type}): ${e.sessions.length} session(s)`;
        })
        .join('\n');
      const confirmed = await prompts.confirm({
        message: `${messages.getMessage('prompt.confirmAllAgents', [
          totalSessions,
          entries.length,
        ])}\n${agentBreakdown}`,
      });
      if (!confirmed) {
        return { ended: [] };
      }
    }

    const ended: EndedSession[] = [];
    const failed: Array<{ task: SessionTask; error: string }> = [];

    for (const entry of entries) {
      const { agentId, sessions } = entry;

      let agent: ScriptAgent | ProductionAgent;
      try {
        const isProduction = sessions[0]?.sessionType === 'published';
        if (isProduction) {
          // eslint-disable-next-line no-await-in-loop
          agent = await Agent.init({ connection: conn, project: this.project!, apiNameOrId: agentId });
        } else {
          // eslint-disable-next-line no-await-in-loop
          agent = await Agent.init({ connection: conn, project: this.project!, aabName: agentId });
        }
      } catch (error) {
        // If we can't init the agent, mark all its sessions as failed.
        const errMsg = SfError.wrap(error).message;
        for (const s of sessions) {
          failed.push({ task: { sessionId: s.sessionId }, error: errMsg });
        }
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const { ended: agentEnded, failed: agentFailed } = await endSessionsForAgent(
        agent,
        sessions.map((s) => ({ sessionId: s.sessionId }))
      );
      ended.push(...agentEnded);
      failed.push(...agentFailed);
    }

    return this.finishEndAll(ended, failed);
  }

  /**
   * Called by endAllForAgent (single specified agent) and endAllAgents (all agents from cache)
   * once ended/failed arrays have been fully aggregated.
   * Throws a partial-failure error if needed; logs success otherwise.
   */
  private finishEndAll(
    ended: EndedSession[],
    failed: Array<{ task: SessionTask; error: string }>
  ): { ended: EndedSession[] } {
    if (failed.length > 0) {
      const failedList = failed.map((f) => `${f.task.sessionId}: ${f.error}`).join(', ');
      const endedIds = ended.map((e) => e.sessionId).join(', ');
      const msg = `Failed to end ${failed.length} session(s): [${failedList}]. Successfully ended ${
        ended.length
      } session(s)${ended.length > 0 ? `: [${endedIds}]` : ''}.`;
      throw new SfError(msg, 'PreviewEndPartialFailure', [], 68);
    }

    this.log(messages.getMessage('output.endedAll', [ended.length]));
    return { ended };
  }
}

type CommandFlags = Interfaces.InferredFlags<typeof AgentPreviewEnd.flags>;

/**
 * Ends a list of sessions on the given agent object serially.
 * Returns { ended, failed } so callers can aggregate results.
 * Does NOT throw on partial failure — callers decide what to do.
 * On failure, the local cache entry is NOT removed (consistent with single-session path behaviour).
 */
async function endSessionsForAgent(
  agent: ScriptAgent | ProductionAgent,
  sessionsToEnd: SessionTask[]
): Promise<{ ended: EndedSession[]; failed: Array<{ task: SessionTask; error: string }> }> {
  const ended: EndedSession[] = [];
  const failed: Array<{ task: SessionTask; error: string }> = [];

  // Sessions are ended serially because setSessionId mutates shared state on the agent object.
  // Parallelising would introduce a race condition where concurrent calls overwrite each other's sessionId.
  for (const task of sessionsToEnd) {
    const { sessionId } = task;
    try {
      agent.setSessionId(sessionId);
      // eslint-disable-next-line no-await-in-loop
      await validatePreviewSession(agent);
      // eslint-disable-next-line no-await-in-loop
      const tracesPath = await agent.getHistoryDir();
      // ScriptAgent flushes traces to disk; ProductionAgent issues the server-side end request.
      // eslint-disable-next-line no-await-in-loop
      await callPreviewEnd(agent);
      // ProductionAgent.endSession() clears this.sessionId after the server call; re-set it so
      // removeCache can call getHistoryDir() without throwing "No sessionId set on agent".
      agent.setSessionId(sessionId);
      // eslint-disable-next-line no-await-in-loop
      await removeCache(agent);
      ended.push({ sessionId, tracesPath });
    } catch (error) {
      failed.push({ task, error: SfError.wrap(error).message });
    }
  }

  return { ended, failed };
}
