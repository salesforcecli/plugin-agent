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
import { createAgentTester, AgentTester, AgentTesterNGT, type TestRunnerType } from '@salesforce/agents';

export type TestRunnerInstance = AgentTester | AgentTesterNGT;

export async function createTestRunner(
  connection: Connection,
  explicitType?: TestRunnerType,
  testDefinitionName?: string,
  runId?: string
): Promise<{ runner: TestRunnerInstance; type: TestRunnerType }> {
  try {
    return await createAgentTester(connection, { explicitType, runId, testDefinitionName });
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
}
