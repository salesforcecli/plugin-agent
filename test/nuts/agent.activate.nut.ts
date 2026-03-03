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

describe('agent activate/deactivate NUTs', function () {
  // Increase timeout for setup and tests since shared setup includes a long wait on Windows
  this.timeout(15 * 60 * 1000); // 15 minutes

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

  before(async function () {
    this.timeout(30 * 60 * 1000); // 30 minutes for setup
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
      execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --json`, {
        ensureExitCode: 0,
      });
    }

    // Verify the BotVersion status is now 'Active'
    const finalStatus = await getBotStatus();
    expect(finalStatus).to.equal('Active');
  });

  it('should activate the agent with version flag', async () => {
    // Ensure agent is inactive first
    const initialStatus = await getBotStatus();
    if (initialStatus === 'Active') {
      execCmd(`agent deactivate --api-name ${botApiName} --target-org ${username} --json`, {
        ensureExitCode: 0,
      });
      await sleep(5000);
    }

    // Activate with version 1
    execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --version 1 --json`, {
      ensureExitCode: 0,
    });

    // Verify the BotVersion status is now 'Active'
    const finalStatus = await getBotStatus();
    expect(finalStatus).to.equal('Active');
  });

  it('should auto-select latest version in JSON mode without version flag', async () => {
    // Ensure agent is inactive first
    const initialStatus = await getBotStatus();
    if (initialStatus === 'Active') {
      execCmd(`agent deactivate --api-name ${botApiName} --target-org ${username} --json`, {
        ensureExitCode: 0,
      });
      await sleep(5000);
    }

    // Activate with --json but no --version flag
    const result = execCmd<{ version: number; success: boolean }>(
      `agent activate --api-name ${botApiName} --target-org ${username} --json`,
      {
        ensureExitCode: 0,
      }
    );

    // Parse the JSON result
    const jsonResult = result.jsonOutput!.result;
    expect(jsonResult?.success).to.equal(true);
    expect(jsonResult?.version).to.be.a('number');

    // Verify the warning was included in the output
    expect(result.shellOutput.stderr).to.include(
      'No version specified, automatically selected latest available version'
    );

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

  it('should deactivate the agent (version automatically detected)', async () => {
    // Ensure agent is active first
    const initialStatus = await getBotStatus();
    if (initialStatus === 'Inactive') {
      execCmd(`agent activate --api-name ${botApiName} --target-org ${username} --version 1 --json`, {
        ensureExitCode: 0,
      });
      await sleep(5000);
    }

    // Deactivate (version is automatically detected)
    execCmd(`agent deactivate --api-name ${botApiName} --target-org ${username} --json`, {
      ensureExitCode: 0,
    });

    // Verify the BotVersion status is now 'Inactive'
    const finalStatus = await getBotStatus();
    expect(finalStatus).to.equal('Inactive');
  });
});
