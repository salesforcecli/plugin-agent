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

import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { Messages, Org, SfError } from '@salesforce/core';
import {
  type AgentforceStudioTestCaseResult,
  type AgentforceStudioTestResultsResponse,
  type CltTestSpec,
  type ConversationTestResultsResponse,
  isCltSpec,
  parseConversationScorerResponse,
  resolveAgent,
  validateCltSpec,
} from '@salesforce/agents';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run');

/** `agent test run --spec` result: a conversation-level run without saving a suite. */
export type ConversationTestRunResult = Omit<ConversationTestResultsResponse, 'status'> & {
  status: 'COMPLETED';
  testScope: 'CONVERSATION_LEVEL';
  /** The server's run status: `Completed` or `Failed`. */
  runStatus: string;
};

/**
 * Reads a conversation-level test spec from a YAML file and validates it for a run without saving.
 * Exit code 2 when the file can't be read, 1 when it isn't a valid conversation-level spec.
 */
export async function readConversationSpec(specPath: string): Promise<CltTestSpec> {
  let content: string;
  try {
    content = await readFile(specPath, 'utf-8');
  } catch (e) {
    throw new SfError(messages.getMessage('error.specFileNotFound', [specPath]), 'SpecFileNotFound', [], 2, e);
  }

  let spec: unknown;
  try {
    spec = YAML.parse(content);
  } catch (e) {
    throw messages.createError('error.invalidSpec', [specPath, SfError.wrap(e).message]);
  }

  if (!isCltSpec(spec)) {
    throw messages.createError('error.specNotConversationLevel', [specPath]);
  }
  try {
    validateCltSpec(spec, { target: 'ephemeral' });
  } catch (e) {
    throw messages.createError('error.invalidSpec', [specPath, SfError.wrap(e).message]);
  }
  return spec;
}

/**
 * Resolves the published agent a spec names (`subjectName`, optional `subjectVersion`) to IDs.
 * Returns `undefined` for a draft agent (`project`), which the converter sends as-is.
 */
export async function resolveConversationAgent(
  org: Org,
  spec: CltTestSpec
): Promise<{ agentId: string; agentVersionId: string } | undefined> {
  if (!spec.subjectName) {
    return undefined;
  }

  let agentId: string;
  let versionId: string;
  try {
    ({ agentId, versionId } = await resolveAgent(org, spec.subjectName));
  } catch (e) {
    throw new SfError(SfError.wrap(e).message, 'AgentNotFound', [], 2, e);
  }
  if (!spec.subjectVersion) {
    return { agentId, agentVersionId: versionId };
  }

  const { records } = await org
    .getConnection()
    .query<{ Id: string }>(
      `SELECT Id FROM BotVersion WHERE BotDefinitionId = '${agentId}' AND DeveloperName = '${escapeSoql(
        spec.subjectVersion
      )}'`
    );
  if (records.length === 0) {
    throw new SfError(
      messages.getMessage('error.agentVersionNotFound', [spec.subjectVersion, spec.subjectName]),
      'AgentVersionNotFound',
      [],
      2
    );
  }
  return { agentId, agentVersionId: records[0].Id };
}

/**
 * Shapes conversation-level results for the shared test-result formatters (human, JUnit, TAP).
 * Each test case's conversation goal comes from the spec, by `testNumber`.
 */
export function toDisplayResults(
  spec: CltTestSpec,
  results: ConversationTestResultsResponse
): AgentforceStudioTestResultsResponse {
  return {
    status: results.status,
    testCases: results.testCases.map((tc): AgentforceStudioTestCaseResult & { inputs: unknown } => ({
      testNumber: tc.testNumber,
      subjectResponse: tc.subjectResponse ?? '',
      testScorerResults: (tc.testScorerResults ?? []).map((s) => ({
        scorerName: s.scorerName,
        scorerResponse: s.scorerResponse ?? '',
      })),
      inputs: [{ name: 'Conversation Goal', value: spec.testCases[tc.testNumber - 1]?.conversationGoal }],
    })),
  };
}

/**
 * True when the run couldn't complete properly: the server reports `Failed` (for example, the agent
 * failed mid-conversation), or a scorer returned `ERROR`. Scorer FAILs are test outcomes, not errors.
 */
export function hasExecutionErrors(results: ConversationTestResultsResponse): boolean {
  return (
    results.status.toLowerCase() === 'failed' ||
    results.testCases.some((tc) =>
      (tc.testScorerResults ?? []).some(
        (s) => parseConversationScorerResponse(s.scorerResponse)?.status?.toUpperCase() === 'ERROR'
      )
    )
  );
}

const escapeSoql = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
