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
import { assignAgentforcePermset } from '../utils/assignAgentforcePermset.js';

/* eslint-disable no-console */

// Module-level variables to ensure only one TestSession is created
let testSession: TestSession | undefined;
let testSessionPromise: Promise<TestSession> | undefined;

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
          // Config path is relative to the project directory (test/mock-projects/agent-generate-template)
          config: 'config/project-scratch-def.json',
        },
      ],
    });

    testSession = session;
    console.log('TestSession created successfully');

    // Get the scratch org username and assign permission set
    const orgs = session.orgs;
    if (orgs && orgs.size > 0) {
      const defaultOrg = orgs.get('default');
      if (defaultOrg?.username) {
        console.log(`Using scratch org: ${defaultOrg.username}`);
        try {
          await assignAgentforcePermset(defaultOrg.username);
          console.log('Permission set assigned to scratch org user');
        } catch (error) {
          console.warn('Warning: Failed to assign permission set:', error);
        }
      }
    }

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

  const defaultOrg = orgs.get('default');
  if (!defaultOrg?.username) {
    throw new Error('Default org username not found in test session.');
  }

  return defaultOrg.username;
}

/**
 * Cleanup function for test hooks. Cleans up the shared test session.
 * This function is idempotent and can be called multiple times safely.
 */
export async function cleanupScratchOrg(): Promise<void> {
  // Wait for any in-progress creation to complete
  if (testSessionPromise && !testSession) {
    try {
      await testSessionPromise;
    } catch (error) {
      console.warn('Warning: Test session creation failed:', error);
    }
  }

  // Clean up the shared test session (this will delete the scratch org)
  if (testSession) {
    await testSession.clean();
    testSession = undefined;
    testSessionPromise = undefined;
  }
}
