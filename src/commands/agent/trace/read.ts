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

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import {
  listSessionTraces,
  readSessionTrace,
  readTurnIndex,
  type PlannerResponse,
  type PlanStep,
  type FunctionStep,
} from '@salesforce/agents';
import { listAllAgentSessions } from '../../../agentSessionScanner.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.trace.read');

export const DIMENSIONS = ['actions', 'grounding', 'routing', 'errors'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

// FunctionStep in @salesforce/agents doesn't declare the optional errors field that the API returns
type FunctionStepWithErrors = FunctionStep & {
  function: FunctionStep['function'] & {
    errors?: Array<{ statusCode: string; message: string }>;
  };
};

export type TurnSummary = {
  turn: number;
  planId: string;
  topic: string;
  userInput: string;
  agentResponse: string;
  actionsExecuted: string[];
  latencyMs: number;
  error: string | null;
};

export type ActionsRow = {
  dimension: 'actions';
  turn: number;
  planId: string;
  action: string;
  input: string;
  output: string;
  latencyMs: number;
  error: string | null;
};
export type GroundingRow = {
  dimension: 'grounding';
  turn: number;
  planId: string;
  prompt: string;
  response: string;
  latencyMs: number;
};
export type RoutingRow = {
  dimension: 'routing';
  turn: number;
  planId: string;
  fromTopic: string;
  toTopic: string;
  intent: string;
};
export type ErrorsRow = {
  dimension: 'errors';
  turn: number;
  planId: string;
  source: string;
  errorCode: string;
  message: string;
};
export type DimensionRow = ActionsRow | GroundingRow | RoutingRow | ErrorsRow;

export type AgentTraceReadResult = {
  sessionId: string;
  format: 'summary' | 'detail' | 'raw';
  dimension?: Dimension;
  turns?: TurnSummary[];
  detail?: DimensionRow[];
  raw?: PlannerResponse[];
};

const isFunctionStep = (s: PlanStep): s is FunctionStep => s.type === 'FunctionStep';
const asFunctionWithErrors = (s: FunctionStep): FunctionStepWithErrors => s as FunctionStepWithErrors;

function summarizeTurn(turn: number, planId: string, trace: PlannerResponse): TurnSummary {
  const plan = trace.plan;
  const userInput = plan.find((s) => s.type === 'UserInputStep');
  const finalResponse = plan.find((s) => s.type === 'PlannerResponseStep');
  const functionSteps = plan.filter(isFunctionStep).map(asFunctionWithErrors);

  const errorStep = functionSteps.find((s) => s.function.errors?.length);
  const errorMsg = errorStep?.function.errors?.[0]?.message ?? null;
  const totalLatency = functionSteps.reduce((acc, s) => acc + (s.executionLatency ?? 0), 0);

  return {
    turn,
    planId,
    topic: trace.topic,
    userInput: userInput?.type === 'UserInputStep' ? userInput.message : '',
    agentResponse: finalResponse?.type === 'PlannerResponseStep' ? finalResponse.message : '',
    actionsExecuted: functionSteps.map((s) => s.function.name),
    latencyMs: totalLatency,
    error: errorMsg,
  };
}

function extractActions(turn: number, planId: string, trace: PlannerResponse): ActionsRow[] {
  return trace.plan
    .filter(isFunctionStep)
    .map(asFunctionWithErrors)
    .map((step) => ({
      dimension: 'actions' as const,
      turn,
      planId,
      action: step.function.name,
      input: JSON.stringify(step.function.input),
      output: JSON.stringify(step.function.output),
      latencyMs: step.executionLatency,
      error: step.function.errors?.length ? step.function.errors[0].message : null,
    }));
}

function extractGrounding(turn: number, planId: string, trace: PlannerResponse): GroundingRow[] {
  return trace.plan
    .filter((s): s is Extract<PlanStep, { type: 'LLMExecutionStep' }> => s.type === 'LLMExecutionStep')
    .filter((s) => s.promptName.includes('React'))
    .map((step) => ({
      dimension: 'grounding' as const,
      turn,
      planId,
      prompt: step.promptName,
      response: step.promptResponse.slice(0, 500),
      latencyMs: step.executionLatency,
    }));
}

function extractRouting(turn: number, planId: string, trace: PlannerResponse): RoutingRow[] {
  const topicStep = trace.plan.find((s) => s.type === 'UpdateTopicStep');
  const eventStep = trace.plan.find((s) => s.type === 'EventStep' && s.eventName === 'topicChangeEvent');
  const fromTopic = eventStep?.type === 'EventStep' ? eventStep.payload.oldTopic : 'null';
  const toTopic = topicStep?.type === 'UpdateTopicStep' ? topicStep.topic : trace.topic;
  return [{ dimension: 'routing' as const, turn, planId, fromTopic, toTopic, intent: trace.intent }];
}

function extractErrors(turn: number, planId: string, trace: PlannerResponse): ErrorsRow[] {
  const rows: ErrorsRow[] = [];
  for (const step of trace.plan) {
    if (step.type === 'FunctionStep') {
      const errors = asFunctionWithErrors(step).function.errors ?? [];
      for (const e of errors) {
        rows.push({
          dimension: 'errors',
          turn,
          planId,
          source: step.function.name,
          errorCode: e.statusCode,
          message: e.message,
        });
      }
    }
    if (step.type === 'EventStep' && step.isError) {
      rows.push({
        dimension: 'errors',
        turn,
        planId,
        source: step.eventName,
        errorCode: 'EVENT_ERROR',
        message: JSON.stringify(step.payload),
      });
    }
  }
  return rows;
}

async function resolvePlanIds(
  agentId: string,
  sessionId: string,
  turn: number | undefined
): Promise<Array<{ turn: number; planId: string }>> {
  const turnIndex = await readTurnIndex(agentId, sessionId);

  if (turn !== undefined) {
    // Try the turn index first (planId may be null if trace wasn't correlated)
    const entry = turnIndex?.turns.find((t) => t.turn === turn && t.planId);
    if (entry?.planId) {
      return [{ turn: entry.turn, planId: entry.planId }];
    }

    // Fall back to positional order from trace files on disk
    const traceFiles = await listSessionTraces(agentId, sessionId);
    const byPosition = traceFiles[turn - 1];
    if (!byPosition) {
      throw new SfError(messages.getMessage('error.turnNotFound', [turn, sessionId]), 'TurnNotFound');
    }
    return [{ turn, planId: byPosition.planId }];
  }

  if (turnIndex) {
    return turnIndex.turns.filter((t) => t.planId !== null).map((t) => ({ turn: t.turn, planId: t.planId! }));
  }

  // Fall back to listing trace files when no turn index exists
  const traceFiles = await listSessionTraces(agentId, sessionId);
  return traceFiles.map((f, i) => ({ turn: i + 1, planId: f.planId }));
}

async function readTraces(
  agentId: string,
  sessionId: string,
  planIds: Array<{ turn: number; planId: string }>
): Promise<{ traces: Array<{ turn: number; planId: string; trace: PlannerResponse }>; failedFiles: string[] }> {
  const traces: Array<{ turn: number; planId: string; trace: PlannerResponse }> = [];
  const failedFiles: string[] = [];

  for (const { turn, planId } of planIds) {
    // eslint-disable-next-line no-await-in-loop
    const trace = await readSessionTrace(agentId, sessionId, planId);
    if (!trace?.plan || !Array.isArray(trace.plan)) {
      failedFiles.push(planId);
      continue;
    }
    traces.push({ turn, planId, trace });
  }

  return { traces, failedFiles };
}

function extractDimension(turn: number, planId: string, trace: PlannerResponse, dimension: Dimension): DimensionRow[] {
  if (dimension === 'actions') return extractActions(turn, planId, trace);
  if (dimension === 'grounding') return extractGrounding(turn, planId, trace);
  if (dimension === 'routing') return extractRouting(turn, planId, trace);
  return extractErrors(turn, planId, trace);
}

export default class AgentTraceRead extends SfCommand<AgentTraceReadResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    'session-id': Flags.string({
      summary: messages.getMessage('flags.session-id.summary'),
      required: true,
      char: 's',
    }),
    format: Flags.option({
      options: ['summary', 'detail', 'raw'] as const,
      default: 'summary' as const,
      summary: messages.getMessage('flags.format.summary'),
      char: 'f',
    })(),
    dimension: Flags.option({
      options: DIMENSIONS,
      summary: messages.getMessage('flags.dimension.summary'),
      char: 'd',
    })(),
    turn: Flags.integer({
      summary: messages.getMessage('flags.turn.summary'),
      char: 't',
    }),
  };

  public async run(): Promise<AgentTraceReadResult> {
    const { flags } = await this.parse(AgentTraceRead);
    const sessionId = flags['session-id'];

    if (flags.format === 'detail' && !flags.dimension) {
      throw new SfError(messages.getMessage('error.detailRequiresDimension'), 'MissingDimension');
    }
    if (flags.dimension && flags.format !== 'detail') {
      this.warn(messages.getMessage('warn.dimensionIgnored', [flags.format]));
    }

    const agentId = await this.resolveAgentId(sessionId);
    const planIds = await resolvePlanIds(agentId, sessionId, flags.turn);

    if (planIds.length === 0) {
      this.log(messages.getMessage('output.empty'));
      return { sessionId, format: flags.format, turns: [], detail: [], raw: [] };
    }

    const { traces, failedFiles } = await readTraces(agentId, sessionId, planIds);

    if (failedFiles.length > 0 && traces.length === 0) {
      throw new SfError(messages.getMessage('error.parseFailedAll', [failedFiles.join(', ')]), 'TraceParseError');
    }
    if (failedFiles.length > 0) {
      this.warn(messages.getMessage('warn.parseFailed', [failedFiles.join(', ')]));
    }

    return this.formatOutput(sessionId, flags.format, flags.dimension, traces);
  }

  private async resolveAgentId(sessionId: string): Promise<string> {
    const allSessions = await listAllAgentSessions(this.project!);
    const entry = allSessions.find((s) => s.sessionId === sessionId);
    if (!entry) {
      throw new SfError(messages.getMessage('error.sessionNotFound', [sessionId]), 'SessionNotFound');
    }
    return entry.agentId;
  }

  private formatOutput(
    sessionId: string,
    format: 'summary' | 'detail' | 'raw',
    dimension: Dimension | undefined,
    traces: Array<{ turn: number; planId: string; trace: PlannerResponse }>
  ): AgentTraceReadResult {
    if (format === 'raw') {
      const raw = traces.map((t) => t.trace);
      if (!this.jsonEnabled()) this.log(JSON.stringify(raw, null, 2));
      return { sessionId, format: 'raw', raw };
    }

    if (format === 'detail') {
      return this.formatDetail(sessionId, dimension!, traces);
    }

    return this.formatSummary(sessionId, traces);
  }

  private formatDetail(
    sessionId: string,
    dimension: Dimension,
    traces: Array<{ turn: number; planId: string; trace: PlannerResponse }>
  ): AgentTraceReadResult {
    const detail: DimensionRow[] = traces.flatMap(({ turn, planId, trace }) =>
      extractDimension(turn, planId, trace, dimension)
    );

    if (detail.length === 0) {
      this.log(messages.getMessage('output.emptyDimension', [dimension]));
      return { sessionId, format: 'detail', dimension, detail: [] };
    }

    if (!this.jsonEnabled()) {
      this.renderDetailTable(dimension, detail);
    }

    return { sessionId, format: 'detail', dimension, detail };
  }

  private renderDetailTable(dimension: Dimension, detail: DimensionRow[]): void {
    if (dimension === 'actions') {
      this.table({
        data: detail as ActionsRow[],
        columns: [
          { key: 'turn', name: messages.getMessage('output.tableHeader.turn') },
          { key: 'action', name: messages.getMessage('output.tableHeader.action') },
          { key: 'input', name: messages.getMessage('output.tableHeader.input') },
          { key: 'output', name: messages.getMessage('output.tableHeader.output') },
          { key: 'latencyMs', name: messages.getMessage('output.tableHeader.latencyMs') },
          { key: 'error', name: messages.getMessage('output.tableHeader.error') },
        ],
      });
    } else if (dimension === 'grounding') {
      this.table({
        data: detail as GroundingRow[],
        columns: [
          { key: 'turn', name: messages.getMessage('output.tableHeader.turn') },
          { key: 'prompt', name: messages.getMessage('output.tableHeader.prompt') },
          { key: 'response', name: messages.getMessage('output.tableHeader.response') },
          { key: 'latencyMs', name: messages.getMessage('output.tableHeader.latencyMs') },
        ],
      });
    } else if (dimension === 'routing') {
      this.table({
        data: detail as RoutingRow[],
        columns: [
          { key: 'turn', name: messages.getMessage('output.tableHeader.turn') },
          { key: 'intent', name: messages.getMessage('output.tableHeader.intent') },
          { key: 'fromTopic', name: messages.getMessage('output.tableHeader.fromTopic') },
          { key: 'toTopic', name: messages.getMessage('output.tableHeader.toTopic') },
        ],
      });
    } else {
      this.table({
        data: detail as ErrorsRow[],
        columns: [
          { key: 'turn', name: messages.getMessage('output.tableHeader.turn') },
          { key: 'source', name: messages.getMessage('output.tableHeader.source') },
          { key: 'errorCode', name: messages.getMessage('output.tableHeader.errorCode') },
          { key: 'message', name: messages.getMessage('output.tableHeader.message') },
        ],
      });
    }
  }

  private formatSummary(
    sessionId: string,
    traces: Array<{ turn: number; planId: string; trace: PlannerResponse }>
  ): AgentTraceReadResult {
    const turns: TurnSummary[] = traces.map(({ turn, planId, trace }) => summarizeTurn(turn, planId, trace));

    if (!this.jsonEnabled()) {
      this.table({
        data: turns.map((t) => ({
          ...t,
          actionsExecuted: t.actionsExecuted.join(', ') || '—',
          error: t.error ?? '—',
          latencyMs: `${t.latencyMs}ms`,
        })),
        columns: [
          { key: 'turn', name: messages.getMessage('output.tableHeader.turn') },
          { key: 'topic', name: messages.getMessage('output.tableHeader.topic') },
          { key: 'userInput', name: messages.getMessage('output.tableHeader.userInput') },
          { key: 'agentResponse', name: messages.getMessage('output.tableHeader.agentResponse') },
          { key: 'actionsExecuted', name: messages.getMessage('output.tableHeader.actionsExecuted') },
          { key: 'latencyMs', name: messages.getMessage('output.tableHeader.latencyMs') },
          { key: 'error', name: messages.getMessage('output.tableHeader.error') },
        ],
      });
    }

    return { sessionId, format: 'summary', turns };
  }
}
