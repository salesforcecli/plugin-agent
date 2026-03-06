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
import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import type { RunEvalResult } from '../../src/commands/agent/test/run-eval.js';
import { getTestSession, getUsername } from './shared-setup.js';

/* eslint-disable no-console */

describe('agent test run-eval', function () {
  // Increase timeout for setup since shared setup includes long waits and deployments
  this.timeout(30 * 60 * 1000); // 30 minutes

  const mockProjectDir = join(process.cwd(), 'test', 'mock-projects', 'agent-generate-template', 'specs');
  const jsonPayloadPath = join(mockProjectDir, 'eval-payload.json');
  const yamlSpecPath = join(mockProjectDir, 'eval-test-spec.yaml');

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
    await getTestSession();
  });

  describe('run-eval with JSON file', () => {
    it('should run evaluation with JSON payload file', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      expect(output?.result).to.be.ok;
      expect(output?.result.tests).to.be.an('array');
      expect(output?.result.tests.length).to.be.greaterThan(0);
      expect(output?.result.summary).to.be.ok;
      expect(output?.result.summary.passed).to.be.a('number');
      expect(output?.result.summary.failed).to.be.a('number');
      expect(output?.result.summary.scored).to.be.a('number');
      expect(output?.result.summary.errors).to.be.a('number');
    });

    it('should run evaluation with normalized payload', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      expect(output?.result.tests[0]).to.be.ok;
      expect(output?.result.tests[0].id).to.equal('test-topic-routing');
      expect(output?.result.tests[0].status).to.be.oneOf(['passed', 'failed']);
      expect(output?.result.tests[0].evaluations).to.be.an('array');
    });
  });

  describe('run-eval with YAML file', () => {
    it('should run evaluation with YAML test spec file', async () => {
      const command = `agent test run-eval --spec ${yamlSpecPath} --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      expect(output?.result).to.be.ok;
      expect(output?.result.tests).to.be.an('array');
      expect(output?.result.tests.length).to.be.greaterThan(0);
      expect(output?.result.summary).to.be.ok;
    });

    it('should auto-infer agent name from YAML subjectName', async () => {
      const command = `agent test run-eval --spec ${yamlSpecPath} --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      // Should succeed without explicit --api-name flag
      expect(output?.result).to.be.ok;
      expect(output?.result.tests).to.be.an('array');
    });
  });

  describe('run-eval with flags', () => {
    it('should respect --no-normalize flag', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --no-normalize --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      expect(output?.result).to.be.ok;
      expect(output?.result.tests).to.be.an('array');
    });

    it('should use custom batch size', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --batch-size 1 --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      expect(output?.result).to.be.ok;
      expect(output?.result.tests).to.be.an('array');
    });

    it('should support different result formats', async () => {
      // Test human format (default) - don't enforce exit code since tests may fail
      const humanCommand = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --result-format human --target-org ${getUsername()}`;
      const humanOutput = execCmd(humanCommand).shellOutput.stdout;

      expect(humanOutput).to.be.ok;
      expect(humanOutput).to.be.a('string');

      // Test tap format - don't enforce exit code since tests may fail
      const tapCommand = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --result-format tap --target-org ${getUsername()}`;
      const tapOutput = execCmd(tapCommand).shellOutput.stdout;

      expect(tapOutput).to.include('TAP version');

      // Test junit format - don't enforce exit code since tests may fail
      const junitCommand = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --result-format junit --target-org ${getUsername()}`;
      const junitOutput = execCmd(junitCommand).shellOutput.stdout;

      expect(junitOutput).to.include('<?xml');
      expect(junitOutput).to.include('testsuite');
    });
  });

  describe('run-eval error handling', () => {
    it('should fail with invalid JSON payload', async () => {
      const invalidJson = join(mockProjectDir, 'invalid-payload.json');
      const command = `agent test run-eval --spec ${invalidJson} --api-name Local_Info_Agent --target-org ${getUsername()} --json`;

      try {
        execCmd<RunEvalResult>(command, { ensureExitCode: 0 });
        expect.fail('Should have thrown an error for invalid JSON');
      } catch (error) {
        // Command should fail with non-zero exit code
        expect((error as Error).message).to.match(/exit code|Invalid test payload/i);
      }
    });

    it('should fail when agent not found', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name NonExistentAgent --target-org ${getUsername()} --json`;

      try {
        execCmd<RunEvalResult>(command, { ensureExitCode: 0 });
        expect.fail('Should have thrown an error for non-existent agent');
      } catch (error) {
        // Command should fail with non-zero exit code
        expect((error as Error).message).to.match(/exit code|agent.*not found/i);
      }
    });

    it('should require --spec flag', async () => {
      const command = `agent test run-eval --api-name Local_Info_Agent --target-org ${getUsername()} --json`;

      try {
        execCmd<RunEvalResult>(command, { ensureExitCode: 0 });
        expect.fail('Should have thrown an error for missing --spec');
      } catch (error) {
        // Command should fail due to missing required flag
        expect((error as Error).message).to.match(/exit code|required|Missing required flag/i);
      }
    });
  });

  describe('run-eval output structure', () => {
    it('should include test summaries with correct structure', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      expect(output?.result.tests).to.be.an('array');
      const firstTest = output?.result.tests[0];
      expect(firstTest).to.have.property('id');
      expect(firstTest).to.have.property('status');
      expect(firstTest).to.have.property('evaluations');
      expect(firstTest?.evaluations).to.be.an('array');
    });

    it('should include summary with all metrics', async () => {
      const command = `agent test run-eval --spec ${jsonPayloadPath} --api-name Local_Info_Agent --target-org ${getUsername()} --json`;
      // Don't enforce exit code 0 since the command exits with 1 if tests fail
      const output = execCmd<RunEvalResult>(command).jsonOutput;

      const summary = output?.result.summary;
      expect(summary).to.have.property('passed');
      expect(summary).to.have.property('failed');
      expect(summary).to.have.property('scored');
      expect(summary).to.have.property('errors');
      expect(summary?.passed).to.be.a('number');
      expect(summary?.failed).to.be.a('number');
      expect(summary?.scored).to.be.a('number');
      expect(summary?.errors).to.be.a('number');
    });
  });
});
