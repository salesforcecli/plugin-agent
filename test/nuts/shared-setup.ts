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
import { Duration, TestSession } from '@salesforce/cli-plugins-testkit';
import { ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { Org, User } from '@salesforce/core';
import { sleep } from '@salesforce/kit';

/* eslint-disable no-console */

// Module-level variables to ensure only one TestSession is created
let testSession: TestSession | undefined;
let testSessionPromise: Promise<TestSession> | undefined;
let agentUsername: string | undefined;

/**
 * Gets the shared TestSession with a scratch org. This ensures only one TestSession
 * is created per test run, even if called from multiple test files simultaneously.
 * All callers will wait for the same creation promise.
 */
export async function getTestSession(): Promise<TestSession> {
  // If already created, return it immediately
  if (testSession) {
    return testSession;
  }

  // If creation is in progress, wait for the same promise
  if (testSessionPromise) {
    return testSessionPromise;
  }

  // Create the TestSession (only once, even if called from multiple test files simultaneously)
  testSessionPromise = (async (): Promise<TestSession> => {
    console.log('Creating shared TestSession with scratch org...');
    const session = await TestSession.create({
      project: {
        sourceDir: join('test', 'mock-projects', 'agent-generate-template'),
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          alias: 'default',
          setDefault: true,
          config: 'config/project-scratch-def.json',
        },
      ],
    });

    testSession = session;
    console.log('TestSession created successfully');

    // Get the scratch org username and assign permission set
    const orgs = session.orgs;
    const defaultOrg = orgs.get('default');

    if (orgs && orgs.size > 0) {
      if (defaultOrg?.username) {
        console.log(`Using scratch org: ${defaultOrg.username}`);
        const org = await Org.create({ aliasOrUsername: defaultOrg.username });
        const connection = org.getConnection();

        // assign the EinsteinGPTPromptTemplateManager to the scratch org admin user
        const queryResult = await connection.singleRecordQuery<{ Id: string; Name: string }>(
          `SELECT Id, Name FROM User WHERE Username='${defaultOrg.username}'`
        );
        const user = await User.create({ org });
        await user.assignPermissionSets(queryResult.Id, ['EinsteinGPTPromptTemplateManager']);
        console.log(`Permission set assigned to scratch org user: ${queryResult.Name}`);
        // Create a new agent user with required permission sets
        console.log('Creating agent user...');

        // Get the 'Einstein Agent User' profile
        const profileResult = await connection.singleRecordQuery<{ Id: string }>(
          "SELECT Id FROM Profile WHERE Name='Einstein Agent User'"
        );

        // Generate a unique username using timestamp to avoid duplicates
        const timestamp = Date.now();
        const domain = defaultOrg.username.split('@')[1];
        agentUsername = `agent.user.${timestamp}@${domain}`;
        const agentUserRecord = await connection.sobject('User').create({
          FirstName: 'Agent',
          LastName: 'User',
          Alias: 'agentusr',
          Email: agentUsername,
          Username: agentUsername,
          ProfileId: profileResult.Id,
          TimeZoneSidKey: 'America/Los_Angeles',
          LocaleSidKey: 'en_US',
          EmailEncodingKey: 'UTF-8',
          LanguageLocaleKey: 'en_US',
        });

        if (!agentUserRecord.success || !agentUserRecord.id) {
          throw new Error(`Failed to create agent user: ${agentUserRecord.errors?.join(', ')}`);
        }

        const agentUserId = agentUserRecord.id;
        console.log(`Agent user created: ${agentUsername} (${agentUserId})`);

        // Assign permission sets to the agent user individually to identify any failures
        const permissionSets = [
          'AgentforceServiceAgentBase',
          'AgentforceServiceAgentUser',
          'EinsteinGPTPromptTemplateUser',
        ];

        // I had issues assigning all permission sets in one pass, assign individually for now
        for (const permissionSet of permissionSets) {
          // eslint-disable-next-line no-await-in-loop
          await user.assignPermissionSets(agentUserId, [permissionSet]);
          console.log(`Permission set assigned: ${permissionSet}`);
        }
        console.log('Permission set assignment completed');

        // Set environment variable for string replacement
        process.env.AGENT_USER_USERNAME = agentUsername;

        console.log('deploying metadata (no AiEvaluationDefinition)');

        const cs1 = await ComponentSetBuilder.build({
          manifest: {
            manifestPath: join(testSession.project.dir, 'noTest.xml'),
            directoryPaths: [testSession.homeDir],
          },
        });
        const deploy1 = await cs1.deploy({ usernameOrConnection: defaultOrg.username });
        await deploy1.pollStatus({ frequency: Duration.seconds(10) });

        console.log('deploying metadata (AiEvaluationDefinition)');

        const cs2 = await ComponentSetBuilder.build({
          manifest: {
            manifestPath: join(testSession.project.dir, 'test.xml'),
            directoryPaths: [testSession.homeDir],
          },
        });
        const deploy2 = await cs2.deploy({ usernameOrConnection: defaultOrg.username });
        await deploy2.pollStatus({ frequency: Duration.seconds(10) });
      }
    }

    // sleep a 3 minutes for org
    await sleep(3 * 1000 * 60);
    return session;
  })();

  return testSessionPromise;
}

/**
 * Gets the scratch org username from the shared test session.
 * Throws an error if the session hasn't been created yet.
 */
export function getUsername(): string {
  if (!testSession) {
    throw new Error('Test session not available. Call getTestSession() first.');
  }

  const orgs = testSession.orgs;
  if (!orgs || orgs.size === 0) {
    throw new Error('No orgs found in test session.');
  }

  return testSession.orgs.get('default')!.username!;
}

/**
 * Gets the agent user, username, from the shared test session.
 * Throws an error if the session hasn't been created yet.
 */
export function getAgentUsername(): string | undefined {
  if (!testSession) {
    throw new Error('Test session not available. Call getTestSession() first.');
  }
  return agentUsername;
}
