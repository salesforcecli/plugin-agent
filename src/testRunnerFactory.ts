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

import { Connection } from '@salesforce/core';
import { AgentTester, AgentTesterNGT, determineTestRunner, TestRunnerType } from '@salesforce/agents';

export type TestRunnerInstance = AgentTester | AgentTesterNGT;

/**
 * Creates the appropriate test runner (NGT or legacy) based on detection or explicit type.
 *
 * @param connection - Salesforce connection
 * @param explicitType - Optional explicit runner type to use (bypasses detection)
 * @param testDefinitionName - Optional test name for conflict detection
 * @returns Object containing the runner instance and its type
 */
export async function createTestRunner(
  connection: Connection,
  explicitType?: TestRunnerType,
  testDefinitionName?: string
): Promise<{ runner: TestRunnerInstance; type: TestRunnerType }> {
  // Use explicit type if provided, otherwise detect
  const runnerType = explicitType ?? (await determineTestRunner(connection, testDefinitionName));

  const runner = runnerType === 'ngt' ? new AgentTesterNGT(connection) : new AgentTester(connection);

  return { runner, type: runnerType };
}
