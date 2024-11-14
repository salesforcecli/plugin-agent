/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { runCommand } from '@oclif/test';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';

describe('agent run test', () => {
  const $$ = new TestContext();
  const testOrg = new MockTestOrgData();

  afterEach(() => {
    $$.restore();
  });

  it('runs agent run test', async () => {
    const { stdout } = await runCommand(`agent:test:run -i the-id -o ${testOrg.username}`);
    expect(stdout).to.include('Agent Test Run: the-id');
  });
});
