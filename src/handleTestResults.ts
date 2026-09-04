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
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  AgentTestResultsResponse,
  AgentforceStudioTestCaseResult,
  AgentforceStudioTestResultsResponse,
  convertTestResultsToFormat,
  humanFriendlyName,
  metric,
} from '@salesforce/agents';
import { XMLBuilder } from 'fast-xml-parser';
import { Ux } from '@salesforce/sf-plugins-core/Ux';
import { ux as ocux } from '@oclif/core';
import ansis from 'ansis';

type TestResultsResponse = AgentTestResultsResponse | AgentforceStudioTestResultsResponse;

function isLegacyResponse(response: TestResultsResponse): response is AgentTestResultsResponse {
  return 'subjectName' in response;
}

async function writeFileToDir(outputDir: string, fileName: string, content: string): Promise<void> {
  // if directory doesn't exist, create it
  await mkdir(outputDir, { recursive: true });

  await writeFile(join(outputDir, fileName), content);
}

function makeSimpleTable(data: Record<string, string>, title: string): string {
  if (Object.keys(data).length === 0) {
    return '';
  }

  const longestKey = Object.keys(data).reduce((acc, key) => (key.length > acc ? key.length : acc), 0);
  const longestValue = Object.values(data).reduce((acc, value) => (value.length > acc ? value.length : acc), 0);
  const table = Object.entries(data)
    .map(([key, value]) => `${key.padEnd(longestKey)}  ${value.padEnd(longestValue)}`)
    .join('\n');

  return `${title}\n${table}`;
}

export function truncate(value: number, decimals = 2): string {
  const remainder = value % 1;
  // truncate remainder to specified decimals
  const fractionalPart = remainder ? remainder.toString().split('.')[1].slice(0, decimals) : '0'.repeat(decimals);
  const wholeNumberPart = Math.floor(value).toString();
  return decimals ? `${wholeNumberPart}.${fractionalPart}` : wholeNumberPart;
}

export function readableTime(time: number, decimalPlaces = 2): string {
  if (time < 1000) {
    return '< 1s';
  }

  // if time < 60s, return time in seconds
  if (time < 60_000) {
    return `${truncate(time / 1000, decimalPlaces)}s`;
  }

  // if time < 60m, return time in minutes and seconds
  if (time < 3_600_000) {
    const minutes = Math.floor(time / 60_000);
    const seconds = truncate((time % 60_000) / 1000, decimalPlaces);
    return `${minutes}m ${seconds}s`;
  }

  // if time >= 60m, return time in hours and minutes
  const hours = Math.floor(time / 3_600_000);
  const minutes = Math.floor((time % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

type ParsedScorerResponse = {
  status?: string;
  score?: number;
  reasoning?: string;
  actualValue?: string;
  expectedValue?: string;
};

function parseScorerResponse(raw: string): ParsedScorerResponse {
  try {
    return JSON.parse(raw) as ParsedScorerResponse;
  } catch {
    return {};
  }
}

// The Agentforce Studio API has been observed emitting `status` in different casings
// across orgs/jobs (e.g. "PASS" vs "Pass") for the same scorer — see W-24087944. Compare
// case-insensitively so rendering doesn't depend on which casing a given job returns.
function isPassStatus(status: unknown): boolean {
  return typeof status === 'string' && status.toUpperCase() === 'PASS';
}

type TestCaseInput = { name: string; value: unknown };

// AgentforceStudioTestCaseResult doesn't yet declare `inputs` in @salesforce/agents,
// but the field is present on the wire — see PR #481 review discussion.
type AgentforceStudioTestCaseResultWithInputs = AgentforceStudioTestCaseResult & { inputs?: unknown };

function getTestCaseInputs(testCase: AgentforceStudioTestCaseResultWithInputs): TestCaseInput[] | undefined {
  const inputs = testCase.inputs;
  if (!Array.isArray(inputs)) {
    return undefined;
  }
  const valid = inputs.filter(
    (i): i is TestCaseInput =>
      typeof i === 'object' &&
      i !== null &&
      typeof (i as TestCaseInput).name === 'string' &&
      (i as TestCaseInput).value !== null &&
      (i as TestCaseInput).value !== undefined
  );
  return valid.length > 0 ? valid : undefined;
}

// Strips VT/ANSI escape sequences from untrusted API data before it's interpolated into
// titleLines, so remote data can't inject raw terminal escapes on the ux.log (non --output-dir) path.
// stripVTControlCharacters doesn't touch plain newlines, so those are collapsed separately.
// It also doesn't touch bare C0 control characters (e.g. a lone \r without a trailing \n),
// which could otherwise be used to visually overwrite already-rendered terminal output, so
// any remaining control characters are stripped outright.
function sanitizeForDisplay(value: string): string {
  return (
    stripVTControlCharacters(value)
      .replace(/\s*[\n\r\v\f]+\s*/g, ' ')
      // eslint-disable-next-line no-control-regex -- intentionally stripping raw C0/DEL control chars, not matching them incidentally
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
  );
}

function formatInputsLine(inputs: TestCaseInput[]): string {
  const shown = inputs.slice(0, 3);
  const remaining = inputs.length - shown.length;
  const pairs = shown.map((i) => `${sanitizeForDisplay(i.name)} = "${sanitizeForDisplay(String(i.value))}"`).join(', ');
  return remaining > 0 ? `${pairs}  (+${remaining} more)` : pairs;
}

type ParsedSubjectResponse = {
  userInput?: string;
  performance?: { latency?: { duration?: number } };
  tokenUsage?: { completion?: number; prompt?: { total?: number }; total?: number };
};

function parseSubjectResponse(raw: string): ParsedSubjectResponse {
  try {
    return JSON.parse(raw) as ParsedSubjectResponse;
  } catch {
    return {};
  }
}

function formatMetricsLine(parsed: ParsedSubjectResponse): string | undefined {
  const parts: string[] = [];
  const latencyMs = parsed.performance?.latency?.duration;
  if (typeof latencyMs === 'number') {
    parts.push(`${ansis.dim('Latency')}: ${latencyMs}ms`);
  }
  const tokenUsage = parsed.tokenUsage;
  const hasTokens =
    tokenUsage !== undefined &&
    (typeof tokenUsage.completion === 'number' ||
      typeof tokenUsage.prompt?.total === 'number' ||
      typeof tokenUsage.total === 'number');
  if (hasTokens) {
    const tokensIn = tokenUsage?.prompt?.total ?? 0;
    const tokensOut = tokenUsage?.completion ?? 0;
    const tokensTotal = tokenUsage?.total ?? 0;
    parts.push(`${ansis.dim('Tokens')}: ${tokensIn} in / ${tokensOut} out / ${tokensTotal} total`);
  }
  return parts.length > 0 ? parts.join('  |  ') : undefined;
}

export function humanFormatAgentforceStudio(results: AgentforceStudioTestResultsResponse): string {
  const ux = new Ux();
  const tables: string[] = [];

  for (const testCase of results.testCases) {
    const inputs = getTestCaseInputs(testCase as AgentforceStudioTestCaseResultWithInputs);
    const parsedSubjectResponse = parseSubjectResponse(testCase.subjectResponse);

    const titleLines = [ansis.bold(`Test Case #${testCase.testNumber}`)];
    if (inputs) {
      titleLines.push(`${ansis.dim('Inputs')}: ${formatInputsLine(inputs)}`);
    } else {
      const userInput = parsedSubjectResponse.userInput ?? '';
      if (userInput) {
        titleLines.push(`${ansis.dim('User Input')}: ${sanitizeForDisplay(userInput)}`);
      }
    }

    const metricsLine = formatMetricsLine(parsedSubjectResponse);
    if (metricsLine) {
      titleLines.push(metricsLine);
    }

    const scorerRows = testCase.testScorerResults.map((scorer) => {
      const parsed = parseScorerResponse(scorer.scorerResponse);
      return {
        scorer: scorer.scorerName,
        result: isPassStatus(parsed.status) ? ansis.green('Pass') : ansis.red('Fail'),
        expected: parsed.expectedValue ?? '',
        actual: parsed.actualValue ?? '',
        reasoning: parsed.reasoning ?? '',
      };
    });

    // Expected/Actual are a paired unit: show both if either has data on any row for this
    // test case, otherwise drop both — never show just one.
    const hasExpectedOrActual = scorerRows.some((row) => row.expected !== '' || row.actual !== '');

    tables.push(
      ux.makeTable({
        title: titleLines.join('\n'),
        overflow: 'wrap',
        columns: [
          { key: 'scorer', name: 'Scorer' },
          { key: 'result', name: 'Result' },
          ...(hasExpectedOrActual
            ? [
                { key: 'expected', name: 'Expected', width: '25%' } as const,
                { key: 'actual', name: 'Actual', width: '25%' } as const,
              ]
            : []),
          { key: 'reasoning', name: 'Reasoning', width: '35%' },
        ],
        data: scorerRows,
        width: '100%',
      })
    );
    tables.push('\n');
  }

  const totalCases = results.testCases.length;
  const passCases = results.testCases.filter((tc) =>
    tc.testScorerResults.every((s) => isPassStatus(parseScorerResponse(s.scorerResponse).status))
  ).length;

  const summary = makeSimpleTable(
    {
      Status: results.status,
      'Total Test Cases': String(totalCases),
      'Passing Test Cases': String(passCases),
      'Failing Test Cases': String(totalCases - passCases),
    },
    ansis.bold.blue('Test Results')
  );

  return tables.join('') + `\n${summary}\n`;
}

function junitFormatAgentforceStudio(results: AgentforceStudioTestResultsResponse): string {
  const builder = new XMLBuilder({ format: true, attributeNamePrefix: '$', ignoreAttributes: false });
  const testCount = results.testCases.length;
  const failureCount = results.testCases.filter((tc) =>
    tc.testScorerResults.some((s) => !isPassStatus(parseScorerResponse(s.scorerResponse).status))
  ).length;

  const suites = builder.build({
    testsuites: {
      $name: 'AgentforceStudioTest',
      $tests: testCount,
      $failures: failureCount,
      property: [{ $name: 'status', $value: results.status }],
      testsuite: results.testCases.map((tc) => ({
        $name: tc.testNumber,
        $assertions: tc.testScorerResults.length,
        failure: tc.testScorerResults
          .map((s) => {
            const parsed = parseScorerResponse(s.scorerResponse);
            if (!isPassStatus(parsed.status)) {
              return { $message: parsed.reasoning ?? 'Unknown error', $name: s.scorerName };
            }
          })
          .filter(Boolean),
      })),
    },
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${suites}`.trim();
}

function tapFormatAgentforceStudio(results: AgentforceStudioTestResultsResponse): string {
  const lines: string[] = [];
  let expectationCount = 0;

  for (const tc of results.testCases) {
    for (const scorer of tc.testScorerResults) {
      const parsed = parseScorerResponse(scorer.scorerResponse);
      const pass = isPassStatus(parsed.status);
      expectationCount++;
      lines.push(`${pass ? 'ok' : 'not ok'} ${expectationCount} ${tc.testNumber}.${scorer.scorerName}`);
      if (!pass) {
        lines.push('  ---');
        lines.push(`  message: ${parsed.reasoning ?? 'Unknown error'}`);
        lines.push(`  scorer: ${scorer.scorerName}`);
        lines.push(`  actual: ${parsed.actualValue ?? ''}`);
        lines.push(`  expected: ${parsed.expectedValue ?? ''}`);
        lines.push('  ...');
      }
    }
  }

  return `TAP version 13\n1..${expectationCount}\n${lines.join('\n')}`;
}

function convertAgentforceStudioTestResultsToFormat(
  results: AgentforceStudioTestResultsResponse,
  format: 'json' | 'junit' | 'tap'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'junit':
      return junitFormatAgentforceStudio(results);
    case 'tap':
      return tapFormatAgentforceStudio(results);
  }
}

export function humanFormat(results: AgentTestResultsResponse, verbose = false): string {
  const ux = new Ux();

  const tables: string[] = [];
  const metricResults = [];
  for (const testCase of results.testCases) {
    let table = ux.makeTable({
      title: `${ansis.bold(`Test Case #${testCase.testNumber}`)}\n${ansis.dim('Utterance')}: ${
        testCase.inputs.utterance
      }`,
      overflow: 'wrap',
      columns: ['test', 'result', { key: 'expected', width: '40%' }, { key: 'actual', width: '40%' }],
      data: testCase.testResults
        // this is the table for topics/action/output validation (actual v expected)
        // filter out other metrics from it
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        .filter((f) => !metric.includes(f.name as (typeof metric)[number]))
        .map((r) => ({
          test: humanFriendlyName(r.name),
          result:
            r.result === 'PASS' ? ansis.green('Pass') : r.status === 'ERROR' ? ansis.red('Error') : ansis.red('Fail'),
          expected: r.expectedValue,
          actual: r.status === 'ERROR' ? r.errorMessage : r.actualValue,
        })),
      width: '100%',
    });
    tables.push(table);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    const metrics = testCase.testResults.filter((f) => metric.includes(f.name as (typeof metric)[number]));

    if (metrics.length > 0) {
      // this is the table for metric information
      // filter out the standard evaluations (topics/action/output)
      table = ux.makeTable({
        overflow: 'wrap',
        columns: [
          { key: 'test', name: 'Metric' },
          'result',
          { key: 'score', name: 'Value (Threshold)' },
          { key: 'metricExplainability', name: 'Explanation' },
        ],
        data: metrics.map((r) => ({
          test: humanFriendlyName(r.name).replace(/^./, (char) => char.toUpperCase()),
          // output_latency_milliseconds will never fail
          result:
            r.result === 'PASS' || r.name === 'output_latency_milliseconds' ? ansis.green('Pass') : ansis.red('Fail'),
          // the threshold is 0.6 for now, in the future it will be customizable per customer
          // for output_latency_milliseconds, the score is a milliseconds of duration, without threshold
          score: r.name === 'output_latency_milliseconds' ? r.score : `${r.score} (0.6)`,
          metricExplainability: r.metricExplainability,
        })),
        width: '100%',
      });
      tables.push(table);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      metricResults.push(...metrics);
    }
    // it's not a real string[], more like just a string  "[&#39;IdentifyRecordByName&#39;]", so >2 means more than "[]"
    if (verbose && testCase.generatedData?.actionsSequence?.length > 2) {
      tables.push(
        ux.makeTable({
          title: 'Generated Data',
          columns: ['Data'],
          overflow: 'wrap',
          trimWhitespace: false,
          data: [
            {
              Data: ocux.colorizeJson(testCase.generatedData.invokedActions, {
                pretty: true,
                theme: {
                  key: 'blueBright',
                  string: 'greenBright',
                  number: 'redBright',
                  boolean: 'redBright',
                  null: 'blackBright',
                },
              }),
            },
          ],
        })
      );
    }
    // add a line break between end of the first table and the utterance of the next
    tables.push('\n');
  }

  const topicPassCount = results.testCases.reduce((acc, tc) => {
    const topic = tc.testResults.find((r) => r.name === 'topic_sequence_match' || r.name === 'topic_assertion');
    return topic?.result === 'PASS' ? acc + 1 : acc;
  }, 0);
  const topicPassPercent = (topicPassCount / results.testCases.length) * 100;

  const actionPassCount = results.testCases.reduce((acc, tc) => {
    const action = tc.testResults.find((r) => r.name === 'action_sequence_match' || r.name === 'actions_assertion');
    return action?.result === 'PASS' ? acc + 1 : acc;
  }, 0);
  const actionPassPercent = (actionPassCount / results.testCases.length) * 100;

  const outcomePassCount = results.testCases.reduce((acc, tc) => {
    const outcome = tc.testResults.find((r) => r.name === 'bot_response_rating' || r.name === 'output_validation');
    return outcome?.result === 'PASS' ? acc + 1 : acc;
  }, 0);
  const outcomePassPercent = (outcomePassCount / results.testCases.length) * 100;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const metricPassCount = metricResults.filter(
    (f) => f.result === 'PASS' || f.name === 'output_latency_milliseconds'
  ).length;
  const metricPassPercent = metricResults.length > 0 ? (metricPassCount / metricResults.length) * 100 : 0;

  const final = {
    Status: results.status,
    Duration: results.endTime
      ? readableTime(new Date(results.endTime).getTime() - new Date(results.startTime).getTime())
      : 'Unknown',
    'Topic Pass %': `${topicPassPercent.toFixed(2)}%`,
    'Action Pass %': `${actionPassPercent.toFixed(2)}%`,
    'Outcome Pass %': `${outcomePassPercent.toFixed(2)}%`,
    ...(metricResults.length ? { 'Metric Pass %': `${metricPassPercent.toFixed(2)}%` } : {}),
  };

  const resultsTable = makeSimpleTable(final, ansis.bold.blue('Test Results'));

  const failedTestCases = results.testCases.filter((tc) => tc.status.toLowerCase() === 'error');
  const failedTestCasesObj = Object.fromEntries(
    Object.entries(failedTestCases).map(([, tc]) => [
      `Test Case #${tc.testNumber}`,
      tc.testResults
        .filter((r) => r.result === 'FAILURE' || r.status === 'ERROR')
        .map((r) => humanFriendlyName(r.name).replace(/^./, (char) => char.toUpperCase()))
        .join(', '),
    ])
  );
  const failedTestCasesTable = makeSimpleTable(failedTestCasesObj, ansis.red.bold('Failed Test Cases'));

  return tables.join('') + `\n${resultsTable}\n\n${failedTestCasesTable}\n`;
}

export async function handleTestResults({
  id,
  format,
  results,
  jsonEnabled,
  outputDir,
  verbose = false,
}: {
  id: string;
  format: 'human' | 'json' | 'junit' | 'tap';
  results: TestResultsResponse | undefined;
  jsonEnabled: boolean;
  outputDir?: string;
  verbose?: boolean;
}): Promise<void> {
  if (!results) {
    // do nothing since there are no results to handle
    return;
  }

  const ux = new Ux({ jsonEnabled });

  if (!isLegacyResponse(results)) {
    const ngtFormatConfig = {
      human: { ext: 'txt', label: 'human-readable', get: () => humanFormatAgentforceStudio(results), strip: true },
      json: {
        ext: 'json',
        label: 'JSON',
        get: () => convertAgentforceStudioTestResultsToFormat(results, 'json'),
        strip: false,
      },
      junit: {
        ext: 'xml',
        label: 'JUnit',
        get: () => convertAgentforceStudioTestResultsToFormat(results, 'junit'),
        strip: false,
      },
      tap: {
        ext: 'txt',
        label: 'TAP',
        get: () => convertAgentforceStudioTestResultsToFormat(results, 'tap'),
        strip: false,
      },
    } as const;
    const cfg = ngtFormatConfig[format];
    const formatted = cfg.get();
    if (outputDir) {
      const file = `test-result-${id}.${cfg.ext}`;
      await writeFileToDir(outputDir, file, cfg.strip ? stripVTControlCharacters(formatted) : formatted);
      ux.log(`Created ${cfg.label} file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
    return;
  }

  // Legacy response formatting
  if (format === 'human') {
    const formatted = humanFormat(results, verbose);
    if (outputDir) {
      const file = `test-result-${id}.txt`;
      await writeFileToDir(outputDir, file, stripVTControlCharacters(formatted));
      ux.log(`Created human-readable file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }

  if (format === 'json') {
    const formatted = await convertTestResultsToFormat(results, 'json');
    if (outputDir) {
      const file = `test-result-${id}.json`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created JSON file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }

  if (format === 'junit') {
    const formatted = await convertTestResultsToFormat(results, 'junit');
    if (outputDir) {
      const file = `test-result-${id}.xml`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created JUnit file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }

  if (format === 'tap') {
    const formatted = await convertTestResultsToFormat(results, 'tap');
    if (outputDir) {
      const file = `test-result-${id}.txt`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created TAP file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }
}
