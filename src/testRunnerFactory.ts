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

import { Connection, SfError } from '@salesforce/core';
import {
  AgentTester,
  AgentTesterNGT,
  detectTestRunnerFromId,
  determineTestRunner,
  TestRunnerType,
} from '@salesforce/agents';

export type TestRunnerInstance = AgentTester | AgentTesterNGT;

/**
 * Creates the appropriate test runner (agentforce-studio or testing-center) based on detection or explicit type.
 *
 * Detection priority:
 * 1. `explicitType` — user-supplied `--test-runner` flag, always wins
 * 2. `runId` prefix — instant detection from the Salesforce ID prefix (`3A2` = agentforce-studio, `4KB` = testing-center), no network call
 * 3. `testDefinitionName` — org metadata query via `determineTestRunner` (network call, used as last resort)
 *
 * @param connection - Salesforce connection
 * @param explicitType - Optional explicit runner type (bypasses all detection)
 * @param testDefinitionName - Optional test name for org metadata detection
 * @param runId - Optional existing run ID; prefix is used for instant detection
 * @returns Object containing the runner instance and its type
 */
export async function createTestRunner(
  connection: Connection,
  explicitType?: TestRunnerType,
  testDefinitionName?: string,
  runId?: string
): Promise<{ runner: TestRunnerInstance; type: TestRunnerType }> {
  const detected = runId ? detectTestRunnerFromId(runId) : undefined;
  let runnerType: TestRunnerType;
  try {
    runnerType = explicitType ?? detected ?? (await determineTestRunner(connection, testDefinitionName));
  } catch (e) {
    const wrapped = SfError.wrap(e);
    if (wrapped.name === 'AmbiguousTestDefinition') {
      throw new SfError(
        wrapped.message,
        wrapped.name,
        ['Use --test-runner to explicitly specify the runner type (agentforce-studio or testing-center)'],
        undefined,
        wrapped
      );
    }
    throw wrapped;
  }

  const runner = runnerType === 'agentforce-studio' ? new AgentTesterNGT(connection) : new AgentTester(connection);
  return { runner, type: runnerType };
}
