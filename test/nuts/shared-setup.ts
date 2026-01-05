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
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { sleep } from '@salesforce/kit';

let testSession: TestSession;
let isCreatingSession = false;

export async function getTestSession(): Promise<TestSession> {
  if (testSession) {
    return testSession;
  }

  if (isCreatingSession) {
    testSession = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
    });
    isCreatingSession = true;
  }

  if (isCreatingSession && !testSession) {
    await sleep(500_000);
  }

  return testSession;
}
