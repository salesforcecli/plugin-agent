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

import { join } from 'node:path';
import { Connection } from '@salesforce/core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import type { TestSession } from '@salesforce/cli-plugins-testkit';

/* eslint-disable no-console */

/**
 * Gets the devhub username from the test session.
 */
export function getDevhubUsername(session: TestSession): string {
  // First try environment variable
  if (process.env.TESTKIT_HUB_USERNAME) {
    return process.env.TESTKIT_HUB_USERNAME;
  }

  // Use session.hubOrg which TestKit keeps authenticated
  if (session.hubOrg?.username) {
    return session.hubOrg.username;
  }

  throw new Error('Devhub username not found. Ensure TESTKIT_HUB_USERNAME is set or devhub is properly authenticated.');
}

export async function deployMetadata(connection: Connection, session: TestSession): Promise<void> {
  // deploy Local_Info_Agent to scratch org
  const compSet1 = await ComponentSetBuilder.build({
    metadata: {
      metadataEntries: ['Agent:Local_Info_Agent'],
      directoryPaths: [join(session.project.dir, 'force-app', 'main', 'default')],
    },
  });
  const deploy1 = await compSet1.deploy({ usernameOrConnection: connection });
  const deployResult1 = await deploy1.pollStatus();
  if (!deployResult1.response.success) {
    console.dir(deployResult1.response, { depth: 10 });
  }
  expect(deployResult1.response.success, 'expected Agent deploy to succeed').to.equal(true);

  // deploy Local_Info_Agent_Test to scratch org
  const compSet2 = await ComponentSetBuilder.build({
    metadata: {
      metadataEntries: ['AiEvaluationDefinition:Local_Info_Agent_Test'],
      directoryPaths: [join(session.project.dir, 'force-app', 'main', 'default')],
    },
  });
  const deploy2 = await compSet2.deploy({ usernameOrConnection: connection });
  const deployResult2 = await deploy2.pollStatus();
  if (!deployResult2.response.success) {
    console.dir(deployResult2.response, { depth: 10 });
  }
  expect(deployResult2.response.success, 'expected Agent Test deploy to succeed').to.equal(true);
}
