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
import { stripVTControlCharacters } from 'node:util';
import { expect, config } from 'chai';
import { AgentTestResultsResponse, AgentforceStudioTestResultsResponse } from '@salesforce/agents';
import ansis from 'ansis';
import { humanFormat, humanFormatAgentforceStudio, readableTime, truncate } from '../src/handleTestResults.js';

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

describe('humanFormatAgentforceStudio - inputs line', () => {
  it('renders Inputs line from testCase.inputs, using the raw field name as-is', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/with-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Inputs: account = "Acme", notes = "what is kafka"');
  });

  it('falls back to User Input when testCase.inputs is absent but subjectResponse.userInput exists', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/legacy-user-input-fallback.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('User Input: What is the account status?');
    expect(output).to.not.include('Inputs:');
  });

  it('omits the inputs line entirely when neither inputs nor userInput is present', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/no-inputs-no-user-input.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.not.include('Inputs:');
    expect(output).to.not.include('User Input:');
  });

  it('truncates to the first 3 inputs and appends a "+N more" suffix', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/many-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Inputs: account = "Acme", region = "ANZ", tier = "Gold"  (+2 more)');
  });

  it('renders all inputs when values are a mix of string and non-string primitives', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/mixed-type-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Inputs: account = "Acme", priority = "5", active = "true"');
    expect(output).to.not.include('more)');
  });

  it('renders an Inputs line (not a User Input fallback) when every input value is non-string', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/all-non-string-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Inputs:');
    expect(output).to.not.include('User Input:');
  });
});

describe('humanFormatAgentforceStudio - sanitizing untrusted display data', () => {
  it('strips ANSI escape sequences from input values before rendering, leaving ansis coloring intact', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/ansi-escape-input.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = humanFormatAgentforceStudio(input);
    expect(output).to.not.include('[31m');
    expect(output).to.not.include('[0m');
    expect(output).to.include('account = "Acme"');
    expect(output).to.include(ansis.bold('Test Case #5'));
  });

  it('collapses embedded newlines in input values to a single space', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/newline-input.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('notes = "line one line two"');
    expect(output).to.not.include('line one\nline two');
  });

  it('strips ANSI escape sequences from the User Input fallback before rendering', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/user-input-with-escapes.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = humanFormatAgentforceStudio(input);
    expect(output).to.not.include('[31m');
    expect(output).to.not.include('[0m');
    expect(output).to.include(ansis.dim('User Input'));
    expect(stripVTControlCharacters(output)).to.include('User Input: What is the account status?');
  });
});

describe('humanFormatAgentforceStudio - latency/tokens line', () => {
  it('renders combined Latency and Tokens line', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/with-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Latency: 842ms  |  Tokens: 156 in / 89 out / 245 total');
  });

  it('renders Latency alone when tokenUsage is missing', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/latency-only.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Latency: 500ms');
    expect(output).to.not.include('Tokens:');
  });

  it('renders Tokens alone when performance is missing', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/tokens-only.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Tokens: 30 in / 20 out / 50 total');
    expect(output).to.not.include('Latency:');
  });

  it('omits the metrics line entirely when neither performance nor tokenUsage is present', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/no-inputs-no-user-input.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.not.include('Latency:');
    expect(output).to.not.include('Tokens:');
  });
});

describe('humanFormatAgentforceStudio - Expected/Actual columns', () => {
  it('omits the Expected and Actual columns when no scorer row has either value', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/with-inputs.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.not.include('Expected');
    expect(output).to.not.include('Actual');
    expect(output).to.include('Scorer');
    expect(output).to.include('Result');
    expect(output).to.include('Reasoning');
  });

  it('shows both the Expected and Actual columns when a scorer row has either value', async () => {
    const raw = await readFile('./test/mocks/agentforce-studio-results/with-expected-actual.json', 'utf8');
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    expect(output).to.include('Expected');
    expect(output).to.include('Actual');
  });

  it('decides Expected/Actual visibility independently per test case', async () => {
    const raw = await readFile(
      './test/mocks/agentforce-studio-results/mixed-expected-actual-per-test-case.json',
      'utf8'
    );
    const input = JSON.parse(raw) as AgentforceStudioTestResultsResponse;
    const output = stripVTControlCharacters(humanFormatAgentforceStudio(input));
    const [testCase9Section, testCase10Section] = output.split('Test Case #10');

    expect(testCase9Section).to.include('Expected');
    expect(testCase9Section).to.include('Actual');
    expect(testCase10Section).to.not.include('Expected');
    expect(testCase10Section).to.not.include('Actual');
  });
});
