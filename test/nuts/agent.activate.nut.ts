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

import { expect } from 'chai';
import { Connection, Org } from '@salesforce/core';
import { sleep } from '@salesforce/kit';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { getTestSession, getUsername } from './shared-setup.js';

/* eslint-disable no-console */

describe('agent activate/deactivate NUTs', () => {
  let connection: Connection;
  let defaultOrg: Org;
  let username: string;
  const botApiName = 'Local_Info_Agent';

  type BotDefinitionWithVersions = {
    Id: string;
    DeveloperName: string;
    BotVersions: {
      records: Array<{ Status: 'Active' | 'Inactive' }>;
    };
  };

  const getBotStatus = async (): Promise<'Active' | 'Inactive'> => {
    const result = await connection.singleRecordQuery<BotDefinitionWithVersions>(
      `SELECT FIELDS(ALL), (SELECT FIELDS(ALL) FROM BotVersions LIMIT 10) FROM BotDefinition WHERE DeveloperName = '${botApiName}' LIMIT 1`
    );
    const lastBotVersion = result.BotVersions.records[result.BotVersions.records.length - 1];
    return lastBotVersion.Status;
  };

  before(async () => {
    await getTestSession();
    username = getUsername();
    defaultOrg = await Org.create({ aliasOrUsername: username });
    connection = defaultOrg.getConnection();
  });

  it('should activate the agent', async () => {
    // Check the initial state and deactivate if already active to ensure clean slate
    const initialStatus = await getBotStatus();
    if (initialStatus === 'Active') {
      console.log('Agent is already active, deactivating to ensure clean slate...');
      execCmd(`agent deactivate --api-name ${botApiName} --target-org ${username} --json`, { ensureExitCode: 0 });
      // Wait a moment for deactivation to complete
      await sleep(5000);
      // Verify it's now inactive
      const afterDeactivate = await getBotStatus();
      expect(afterDeactivate).to.equal('Inactive');
    } else {
      expect(initialStatus).to.equal('Inactive');
    }

    try {
      execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --json`, {
        ensureExitCode: 0,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'unknown';
      const waitMin = 3;
      console.log(`Error activating agent due to ${errMsg}. \nWaiting ${waitMin} minutes and trying again...`);
      await sleep(waitMin * 60 * 1000);
      console.log(`${waitMin} minutes is up, retrying now.`);
      execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --json`, {
        ensureExitCode: 0,
      });
    }

    // Verify the BotVersion status is now 'Active'
    const finalStatus = await getBotStatus();
    expect(finalStatus).to.equal('Active');
  });

  it('should deactivate the agent', async () => {
    // Verify the BotVersion status has 'Active' initial state
    const initialStatus = await getBotStatus();
    expect(initialStatus).to.equal('Active');

    execCmd(`agent deactivate --api-name ${botApiName} --target-org ${username} --json`, {
      ensureExitCode: 0,
    });

    // Verify the BotVersion status is now 'Inactive'
    const finalStatus = await getBotStatus();
    expect(finalStatus).to.equal('Inactive');
  });
});
