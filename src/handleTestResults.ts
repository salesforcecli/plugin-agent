/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { AgentTestResultsResponse, convertTestResultsToFormat, humanFriendlyName, metric } from '@salesforce/agents';
import { Ux } from '@salesforce/sf-plugins-core/Ux';
import { ux as ocux } from '@oclif/core';
import ansis from 'ansis';

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

  // if time < 1000ms, return time in ms
  if (time < 1000) {
    return `${time}ms`;
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

export function humanFormat(results: AgentTestResultsResponse): string {
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
    if (testCase.generatedData?.actionsSequence?.length > 2) {
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
}: {
  id: string;
  format: 'human' | 'json' | 'junit' | 'tap';
  results: AgentTestResultsResponse | undefined;
  jsonEnabled: boolean;
  outputDir?: string;
}): Promise<void> {
  if (!results) {
    // do nothing since there are no results to handle
    return;
  }

  const ux = new Ux({ jsonEnabled });

  if (format === 'human') {
    const formatted = humanFormat(results);
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
