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

import * as fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Connection } from '@salesforce/core';
import { normalizePayload, splitIntoBatches, type EvalPayload } from '../../../evalNormalizer.js';
import { formatResults, type ResultFormat, type EvalApiResponse } from '../../../evalFormatter.js';
import { resultFormatFlag } from '../../../flags.js';
import { isYamlTestSpec, parseTestSpec, translateTestSpec } from '../../../yamlSpecTranslator.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run-eval');

export type RunEvalResult = {
  tests: Array<{ id: string; status: string; evaluations: unknown[] }>;
  summary: { passed: number; failed: number; scored: number; errors: number };
};

// --- Standalone helper functions ---

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', (err: Error) => reject(err));
  });
}

async function callEvalApi(conn: Connection, payload: EvalPayload, orgId: string, userId: string): Promise<unknown> {
  const instanceUrl = conn.instanceUrl;
  const accessToken = conn.accessToken!;

  const response = await fetch('https://api.salesforce.com/einstein/evaluation/v1/tests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-sfdc-core-tenant-id': `core/prod/${orgId}`,
      'x-org-id': orgId,
      'x-sfdc-core-instance-url': instanceUrl,
      'x-sfdc-user-id': userId,
      'x-client-feature-id': 'AIPlatformEvaluation',
      'x-sfdc-app-context': 'EinsteinGPT',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw messages.createError('error.apiError', [response.status.toString(), errorText]);
  }

  return response.json();
}

async function resolveOrgMetadata(conn: Connection): Promise<{ orgId: string; userId: string }> {
  const orgResult = await conn.query<{ Id: string }>('SELECT Id FROM Organization');
  const orgId = orgResult.records[0].Id;

  const userInfo = await conn.request<{ user_id: string }>(`${conn.instanceUrl}/services/oauth2/userinfo`);
  const userId = userInfo.user_id;

  return { orgId, userId };
}

async function resolveAgent(conn: Connection, apiName: string): Promise<{ agentId: string; versionId: string }> {
  const botResult = await conn.query<{ Id: string }>(`SELECT Id FROM BotDefinition WHERE DeveloperName = '${apiName}'`);
  if (!botResult.records.length) {
    throw messages.createError('error.agentNotFound', [apiName]);
  }
  const agentId = botResult.records[0].Id;

  const versionResult = await conn.query<{ Id: string }>(
    `SELECT Id FROM BotVersion WHERE BotDefinitionId = '${agentId}' ORDER BY VersionNumber DESC LIMIT 1`
  );
  if (!versionResult.records.length) {
    throw messages.createError('error.agentVersionNotFound', [apiName]);
  }
  const versionId = versionResult.records[0].Id;

  return { agentId, versionId };
}

async function executeBatches(
  conn: Connection,
  batches: Array<EvalPayload['tests']>,
  orgId: string,
  userId: string,
  log: (msg: string) => void
): Promise<unknown[]> {
  const allResults: unknown[] = [];

  for (let i = 0; i < batches.length; i++) {
    if (batches.length > 1) {
      log(messages.getMessage('info.batchProgress', [i + 1, batches.length, batches[i].length]));
    }

    const batchPayload: EvalPayload = { tests: batches[i] };
    // eslint-disable-next-line no-await-in-loop
    const result = await callEvalApi(conn, batchPayload, orgId, userId);
    const resultObj = result as { results?: unknown[] };
    allResults.push(...(resultObj.results ?? []));
  }

  return allResults;
}

function buildResultSummary(mergedResponse: EvalApiResponse): {
  summary: RunEvalResult['summary'];
  testSummaries: RunEvalResult['tests'];
} {
  const summary = { passed: 0, failed: 0, scored: 0, errors: 0 };
  const testSummaries: Array<{ id: string; status: string; evaluations: unknown[] }> = [];

  for (const testResult of mergedResponse.results ?? []) {
    const tr = testResult as Record<string, unknown>;
    const testId = (tr.id as string) ?? 'unknown';
    const evalResults = (tr.evaluation_results as Array<Record<string, unknown>>) ?? [];
    const testErrors = (tr.errors as unknown[]) ?? [];

    const passed = evalResults.filter((e) => e.is_pass === true).length;
    const failed = evalResults.filter((e) => e.is_pass === false).length;
    const scored = evalResults.filter((e) => e.score != null && e.is_pass == null).length;

    summary.passed += passed;
    summary.failed += failed;
    summary.scored += scored;
    summary.errors += testErrors.length;

    testSummaries.push({
      id: testId,
      status: failed > 0 || testErrors.length > 0 ? 'failed' : 'passed',
      evaluations: evalResults,
    });
  }

  return { summary, testSummaries };
}

export default class AgentTestRunEval extends SfCommand<RunEvalResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    spec: Flags.file({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.spec.summary'),
    }),
    'agent-api-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.agent-api-name.summary'),
    }),
    wait: Flags.integer({
      char: 'w',
      default: 10,
      summary: messages.getMessage('flags.wait.summary'),
    }),
    'result-format': resultFormatFlag(),
    'batch-size': Flags.integer({
      default: 5,
      summary: messages.getMessage('flags.batch-size.summary'),
    }),
    'no-normalize': Flags.boolean({
      default: false,
      summary: messages.getMessage('flags.no-normalize.summary'),
    }),
  };

  public async run(): Promise<RunEvalResult> {
    const { flags } = await this.parse(AgentTestRunEval);
    const conn = flags['target-org'].getConnection(flags['api-version']);

    // 1. Read from file or stdin
    const specPath = flags.spec;
    let rawContent: string;

    if (specPath === '-') {
      rawContent = await readStdin();
    } else {
      rawContent = fs.readFileSync(specPath, 'utf-8');
    }

    // 2. Detect format and parse
    let payload: EvalPayload;
    let agentApiName = flags['agent-api-name'];

    if (isYamlTestSpec(rawContent)) {
      // YAML TestSpec detected — translate to EvalPayload
      const spec = parseTestSpec(rawContent);
      payload = translateTestSpec(spec);

      // Auto-infer agent-api-name from subjectName if not explicitly provided
      if (!agentApiName) {
        agentApiName = spec.subjectName;
        this.log(messages.getMessage('info.yamlDetected', [spec.subjectName, spec.testCases.length.toString()]));
      }
    } else {
      // JSON EvalPayload (original behavior)
      try {
        payload = JSON.parse(rawContent) as EvalPayload;
      } catch (e) {
        throw messages.createError('error.invalidPayload', [(e as Error).message]);
      }
    }

    if (!payload.tests || !Array.isArray(payload.tests) || payload.tests.length === 0) {
      throw messages.createError('error.invalidPayload', ['missing or empty "tests" array']);
    }

    // 3. If --agent-api-name (or auto-inferred from YAML), resolve IDs and inject
    if (agentApiName) {
      const { agentId, versionId } = await resolveAgent(conn, agentApiName);
      for (const test of payload.tests) {
        for (const step of test.steps) {
          if (step.type === 'agent.create_session') {
            // eslint-disable-next-line camelcase
            step.agent_id = agentId;
            // eslint-disable-next-line camelcase
            step.agent_version_id = versionId;
          }
        }
      }
    }

    // 4. Normalize payload unless --no-normalize
    if (!flags['no-normalize']) {
      payload = normalizePayload(payload);
    }

    // 5. Clamp batch size
    const batchSize = Math.min(Math.max(flags['batch-size'], 1), 5);

    // 6. Split into batches
    const batches = splitIntoBatches(payload.tests, batchSize);

    // 7. Resolve org metadata for API headers
    const { orgId, userId } = await resolveOrgMetadata(conn);

    // 8. Execute batches
    const allResults = await executeBatches(conn, batches, orgId, userId, (msg) => this.log(msg));

    const mergedResponse: EvalApiResponse = { results: allResults as EvalApiResponse['results'] };

    // 9. Format output
    const resultFormat = (flags['result-format'] ?? 'human') as ResultFormat;
    const formatted = formatResults(mergedResponse, resultFormat);
    this.log(formatted);

    // 10. Build structured result for --json
    const { summary, testSummaries } = buildResultSummary(mergedResponse);

    // Set exit code to 1 if any tests failed
    if (summary.failed > 0 || summary.errors > 0) {
      process.exitCode = 1;
    }

    return { tests: testSummaries, summary };
  }
}
