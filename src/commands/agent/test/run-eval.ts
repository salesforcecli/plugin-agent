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
import { Flags, SfCommand, toHelpSection } from '@salesforce/sf-plugins-core';
import { EnvironmentVariable, Messages, SfError } from '@salesforce/core';
import {
  type EvalPayload,
  normalizePayload,
  splitIntoBatches,
  type EvalApiResponse,
  formatResults,
  type ResultFormat,
  isYamlTestSpec,
  parseTestSpec,
  translateTestSpec,
  resolveAgent,
  executeBatches,
  buildResultSummary,
} from '@salesforce/agents';
import { resultFormatFlag } from '../../../flags.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-agent', 'agent.test.run-eval');

export type RunEvalResult = {
  tests: Array<{ id: string; status: string; evaluations: unknown[]; outputs: unknown[] }>;
  summary: { passed: number; failed: number; scored: number; errors: number };
};

async function resolveAndInjectAgent(
  org: Parameters<typeof resolveAgent>[0],
  agentApiName: string,
  payload: EvalPayload
): Promise<void> {
  let agentId: string;
  let versionId: string;
  try {
    ({ agentId, versionId } = await resolveAgent(org, agentApiName));
  } catch (e) {
    const wrapped = SfError.wrap(e);
    throw new SfError(`Agent '${agentApiName}' not found.`, 'AgentNotFound', [], 2, wrapped);
  }
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

export default class AgentTestRunEval extends SfCommand<RunEvalResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly envVariablesSection = toHelpSection(
    'ENVIRONMENT VARIABLES',
    EnvironmentVariable.SF_TARGET_ORG
  );

  public static readonly errorCodes = toHelpSection('ERROR CODES', {
    'Succeeded (0)': 'Tests completed successfully. Test results (passed/failed) are in the JSON output.',
    'Failed (1)': "Tests encountered execution errors (tests couldn't run properly).",
    'NotFound (2)': 'Agent not found, spec file not found, or invalid agent name.',
    'OperationFailed (4)': 'Failed to execute tests due to API or network errors.',
  });

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    spec: Flags.string({
      char: 's',
      required: true,
      summary: messages.getMessage('flags.spec.summary'),
      allowStdin: true,
    }),
    'api-name': Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.api-name.summary'),
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
    const org = flags['target-org'];

    // 1. Get spec content (from file or stdin via allowStdin)
    let rawContent = flags.spec;
    let isYaml = isYamlTestSpec(rawContent);

    if (!isYaml) {
      try {
        JSON.parse(rawContent);
      } catch {
        try {
          rawContent = await readFile(flags.spec, 'utf-8');
        } catch (e) {
          const wrapped = SfError.wrap(e);
          throw new SfError(`Spec file not found: ${flags.spec}`, 'SpecFileNotFound', [], 2, wrapped);
        }
        isYaml = isYamlTestSpec(rawContent);
      }
    }

    // 2. Detect format and parse
    let payload!: EvalPayload;
    let agentApiName = flags['api-name'];

    if (isYaml) {
      try {
        const spec = parseTestSpec(rawContent);
        payload = translateTestSpec(spec);

        if (!agentApiName) {
          agentApiName = spec.subjectName;
          this.log(messages.getMessage('info.yamlDetected', [spec.subjectName, spec.testCases.length.toString()]));
        }
      } catch (e) {
        throw messages.createError('error.invalidPayload', [(e as Error).message]);
      }
    } else {
      try {
        payload = JSON.parse(rawContent) as EvalPayload;
      } catch (e) {
        throw messages.createError('error.invalidPayload', [(e as Error).message]);
      }
    }

    if (!payload.tests || !Array.isArray(payload.tests) || payload.tests.length === 0) {
      throw messages.createError('error.invalidPayload', ['missing or empty "tests" array']);
    }

    for (const test of payload.tests) {
      if (!Array.isArray(test.steps)) {
        throw messages.createError('error.invalidPayload', [`test '${test.id}' has missing or invalid 'steps' array`]);
      }
    }

    // 3. If --api-name (or auto-inferred from YAML), resolve IDs and inject
    if (agentApiName) {
      await resolveAndInjectAgent(org, agentApiName, payload);
    }

    // 4. Normalize payload unless --no-normalize
    if (!flags['no-normalize']) {
      payload = normalizePayload(payload);
    }

    // 5. Clamp batch size and split into batches
    const batchSize = Math.min(Math.max(flags['batch-size'], 1), 5);
    const batches = splitIntoBatches(payload.tests, batchSize);

    // 6. Execute batches
    const allResults = await executeBatches(org, batches, (msg) => this.log(msg)).catch((e) => {
      const wrapped = SfError.wrap(e);
      throw new SfError(
        `Failed to execute tests: ${wrapped.message}`,
        'TestExecutionFailed',
        [wrapped.message],
        4,
        wrapped
      );
    });

    const mergedResponse: EvalApiResponse = { results: allResults as EvalApiResponse['results'] };

    // 7. Format output
    this.log(formatResults(mergedResponse, (flags['result-format'] ?? 'human') as ResultFormat));

    // 8. Build structured result for --json
    const { summary, testSummaries } = buildResultSummary(mergedResponse);

    if (summary.errors > 0) {
      process.exitCode = 1;
    }

    return { tests: testSummaries, summary };
  }
}
