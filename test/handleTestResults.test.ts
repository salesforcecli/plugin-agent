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
import { readFile } from 'node:fs/promises';
import { expect, config } from 'chai';
import { AgentTestResultsResponse } from '@salesforce/agents';
import { humanFormat, readableTime, truncate } from '../src/handleTestResults.js';

config.truncateThreshold = 0;

describe('human format', () => {
  it('should transform test results to human readable format', async () => {
    const raw = await readFile('./test/mocks/einstein_ai-evaluations_runs_4KBSM000000003F4AQ_results/4.json', 'utf8');
    const input = JSON.parse(raw) as AgentTestResultsResponse;
    const utterances = input.testCases.map((testCase) => testCase.inputs.utterance);
    const output = humanFormat(input);
    expect(output).to.be.ok;
    expect(output).to.include('Test Case #1');
    expect(output).to.include('Test Case #2');
    expect(output).to.include('Test Case #3');

    // Check that all utterances are present in the output
    // Utterances could be split across multiple lines, so we replace newlines with spaces
    const singleLineOutput = output.replaceAll('\n', ' ');
    for (const utterance of utterances) {
      expect(singleLineOutput).to.include(utterance);
    }

    expect(output).to.include('Test Results');
  });
});

describe('readableTime', () => {
  it('should convert milliseconds to a human readable time', () => {
    expect(readableTime(0)).to.equal('< 1s');
    expect(readableTime(1)).to.equal('< 1s');
    expect(readableTime(999)).to.equal('< 1s');
    expect(readableTime(1000)).to.equal('1.00s');
    expect(readableTime(1001)).to.equal('1.00s');
  });

  it('should convert milliseconds to seconds', () => {
    expect(readableTime(1500)).to.equal('1.5s');
    expect(readableTime(59_000)).to.equal('59.00s');
  });

  it('should convert milliseconds to minutes and seconds', () => {
    expect(readableTime(60_000)).to.equal('1m 0.00s');
    expect(readableTime(61_000)).to.equal('1m 1.00s');
    expect(readableTime(3_599_000)).to.equal('59m 59.00s');
  });

  it('should convert milliseconds to hours and minutes', () => {
    expect(readableTime(3_600_000)).to.equal('1h 0m');
    expect(readableTime(3_660_000)).to.equal('1h 1m');
    expect(readableTime(86_399_999)).to.equal('23h 59m');
  });
});

describe('truncate', () => {
  it('should truncate to 2 decimal places by default', () => {
    expect(truncate(1.2345)).to.equal('1.23');
    expect(truncate(1.2399)).to.equal('1.23');
  });

  it('should truncate to specified decimal places', () => {
    expect(truncate(1.2345, 1)).to.equal('1.2');
    expect(truncate(1.2399, 3)).to.equal('1.239');
  });

  it('should handle whole numbers correctly', () => {
    expect(truncate(1)).to.equal('1.00');
    expect(truncate(1, 0)).to.equal('1');
  });

  it('should handle zero correctly', () => {
    expect(truncate(0)).to.equal('0.00');
    expect(truncate(0, 0)).to.equal('0');
  });
});

describe('metric calculations', () => {
  it('should handle test cases with no metrics', async () => {
    const raw = await readFile('./test/mocks/einstein_ai-evaluations_runs_4KBSM000000003F4AQ_results/4.json', 'utf8');
    const input = JSON.parse(raw) as AgentTestResultsResponse;
    const output = humanFormat(input);
    expect(output).to.not.include('Metric Pass %');
  });
  it('should correctly calculate metric pass percentage', async () => {
    const raw = await readFile('./test/mocks/einstein_ai-evaluations_runs_4KBSM000000003F4AQ_results/5.json', 'utf8');
    const input = JSON.parse(raw) as AgentTestResultsResponse;
    const output = humanFormat(input);
    expect(output).to.include('Metric Pass %   33.33%');
  });

  it('should handle test cases where all metrics fail', async () => {
    const raw = await readFile('./test/mocks/einstein_ai-evaluations_runs_4KBSM000000003F4AQ_results/6.json', 'utf8');
    const input = JSON.parse(raw) as AgentTestResultsResponse;
    const output = humanFormat(input);
    expect(output).to.include('Metric Pass %   0.00%');
  });
});
