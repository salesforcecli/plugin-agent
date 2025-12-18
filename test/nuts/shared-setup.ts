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
import { readFileSync, writeFileSync } from 'node:fs';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { Connection, Org, User, UserFields, StateAggregator } from '@salesforce/core';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { genUniqueString } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

export type SharedTestContext = {
  session: TestSession;
  connection: Connection;
  defaultOrg: Org;
  username: string;
  botApiName: string;
  botUsername: string;
};

let sharedContext: SharedTestContext | null = null;

/**
 * Initialize the shared test context with a devhub setup.
 * This should be called once in main.nut.ts before any other tests run.
 * Uses the authenticated devhub as the target-org, or an existing org via TESTKIT_ORG_USERNAME.
 */
export async function initializeSharedContext(): Promise<SharedTestContext> {
  if (sharedContext) {
    return sharedContext;
  }

  const botApiName = 'Local_Info_Agent';

  // Check if using an existing org via TESTKIT_ORG_USERNAME
  const existingOrgUsername = process.env.TESTKIT_ORG_USERNAME;
  const useExistingOrg = Boolean(existingOrgUsername);

  if (useExistingOrg) {
    console.log(`Using existing org for testing: ${existingOrgUsername}`);
  } else {
    console.log('Using authenticated devhub for testing...');
  }

  const session = await TestSession.create({
    project: {
      sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
    },
    devhubAuthStrategy: 'AUTO',
    // Don't create scratch orgs - use devhub directly
  });

  // Get username from existing org env var or from devhub
  let username: string;
  let defaultOrg: Org;
  let connection: Connection;

  if (useExistingOrg) {
    username = existingOrgUsername as string;
    // Try to create org - will fail if not authenticated
    try {
      defaultOrg = await Org.create({ aliasOrUsername: username });
      connection = defaultOrg.getConnection();
    } catch (error) {
      throw new Error(
        `Failed to authenticate to org ${username}. ` +
          `Please ensure the org is authenticated by running: sf org login web --alias <alias> --instance-url <url> --set-default-username ${username} ` +
          `or: sf org login web --instance-url <url> --set-default-username ${username}\n` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    console.log(`Testing with username: ${username}`);
  } else {
    // Get devhub org from StateAggregator (config)
    try {
      const stateAggregator = await StateAggregator.getInstance();
      const orgs = stateAggregator.orgs.getAll();

      // Find the devhub org (has isDevHub: true)
      const devHubOrg = orgs.find((org) => org.isDevHub === true);

      if (!devHubOrg?.username) {
        throw new Error('No devhub org found in config.');
      }

      username = devHubOrg.username;
      defaultOrg = await Org.create({ aliasOrUsername: username });
      connection = defaultOrg.getConnection();
      console.log(`Using devhub for testing. Username: ${username}`);
    } catch (error) {
      throw new Error(
        'Failed to get authenticated devhub org. ' +
          'Please ensure a devhub is authenticated by running: sf org login web --alias <alias> --instance-url <url> --set-default-dev-hub ' +
          'or set TESTKIT_ORG_USERNAME environment variable to use a specific org.\n' +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // assign the EinsteinGPTPromptTemplateManager to the scratch org admin user
  const queryResult = await connection.singleRecordQuery<{ Id: string }>(
    `SELECT Id FROM User WHERE Username='${username}'`
  );
  const user = await User.create({ org: defaultOrg });
  await user.assignPermissionSets(queryResult.Id, ['EinsteinGPTPromptTemplateManager']);

  // create a bot user
  const botUsername = await createBotUser(connection, defaultOrg, botApiName, session);

  // deploy metadata
  await deployMetadata(connection, session);

  // wait for the agent to be provisioned (only for new scratch orgs)
  // Skip wait when using devhub or existing org

  sharedContext = {
    session,
    connection,
    defaultOrg,
    username,
    botApiName,
    botUsername,
  };

  return sharedContext;
}

/**
 * Get the shared test context. Throws if not initialized.
 */
export function getSharedContext(): SharedTestContext {
  if (!sharedContext) {
    throw new Error('Shared context not initialized. Call initializeSharedContext() first.');
  }
  return sharedContext;
}

/**
 * Clean up the shared test context.
 * Only cleans up if we created a scratch org (not when using TESTKIT_ORG_USERNAME or devhub).
 */
export async function cleanupSharedContext(): Promise<void> {
  if (sharedContext) {
    const useExistingOrg = Boolean(process.env.TESTKIT_ORG_USERNAME);
    if (!useExistingOrg) {
      // Only clean up if we created a scratch org (not when using devhub)
      await sharedContext.session?.clean();
    }
    sharedContext = null;
  }
}

const createBotUser = async (
  connection: Connection,
  defaultOrg: Org,
  botApiName: string,
  session: TestSession
): Promise<string> => {
  // Query for the agent user profile
  const queryResult = await connection.singleRecordQuery<{ Id: string }>(
    "SELECT Id FROM Profile WHERE Name='Einstein Agent User'"
  );
  const profileId = queryResult.Id;

  // create a new unique bot user
  const botUsername = genUniqueString('botUser_%s@test.org');
  const botUser = await User.create({ org: defaultOrg });
  // @ts-expect-error - private method. Must use this to prevent the auth flow that happens with the createUser method
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const { userId } = (await botUser.createUserInternal({
    username: botUsername,
    lastName: 'AgentUser',
    alias: 'botUser',
    timeZoneSidKey: 'America/Denver',
    email: botUsername,
    emailEncodingKey: 'UTF-8',
    languageLocaleKey: 'en_US',
    localeSidKey: 'en_US',
    profileId,
  } as UserFields)) as { userId: string };

  await botUser.assignPermissionSets(userId, ['AgentforceServiceAgentUser']);

  // Replace the botUser with the current user's username
  const botDir = join(session.project.dir, 'force-app', 'main', 'default', 'bots', botApiName);
  const botFile = readFileSync(join(botDir, 'Local_Info_Agent.bot-meta.xml'), 'utf8');
  const updatedBotFile = botFile.replace('%BOT_USER%', botUsername);
  writeFileSync(join(botDir, 'Local_Info_Agent.bot-meta.xml'), updatedBotFile);

  return botUsername;
};

const deployMetadata = async (connection: Connection, session: TestSession): Promise<void> => {
  // deploy Local_Info_Agent to scratch org
  const compSet1 = await ComponentSetBuilder.build({
    metadata: {
      metadataEntries: ['Agent:Local_Info_Agent'],
      directoryPaths: [join(session.project.dir, 'force-app', 'main', 'default')],
    },
  });
  const deploy1 = await compSet1.deploy({ usernameOrConnection: connection });
  const deployResult1 = await deploy1.pollStatus();
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
  expect(deployResult2.response.success, 'expected Agent Test deploy to succeed').to.equal(true);
};
