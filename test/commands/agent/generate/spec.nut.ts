/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, resolve } from 'node:path';
import { statSync } from 'node:fs';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentCreateSpecResult } from '../../../../src/commands/agent/generate/spec.js';

describe('agent generate spec NUTs', () => {
  let session: TestSession;
  const mockDir = resolve(join('test', 'mocks'));

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { name: 'agentGenerateSpec' },
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should write yaml spec file with minimal flags', async () => {
    const targetOrg = `--target-org ${session.hubOrg.username}`;
    const type = 'customer';
    const role = 'test agent role';
    const companyName = 'Test Company Name';
    const companyDescription = 'Test Company Description';
    const companyWebsite = 'https://test-company-website.org';
    const command = `agent generate spec ${targetOrg} --type ${type} --role "${role}" --company-name "${companyName}" --company-description "${companyDescription}" --company-website ${companyWebsite} --json`;
    const output = execCmd<AgentCreateSpecResult>(command, {
      ensureExitCode: 0,
      env: { ...process.env, SF_MOCK_DIR: mockDir },
    }).jsonOutput;

    const expectedFilePath = resolve(session.project.dir, 'config', 'agentSpec.yaml');
    expect(output?.result.isSuccess).to.be.true;
    expect(output?.result.specPath).to.equal(expectedFilePath);
    expect(output?.result.agentType).to.equal(type);
    expect(output?.result.role).to.equal(role);
    expect(output?.result.companyName).to.equal(companyName);
    expect(output?.result.companyDescription).to.equal(companyDescription);
    expect(output?.result.topics).to.be.an('array').with.lengthOf(10);
    const fileStat = statSync(expectedFilePath);
    expect(fileStat.isFile()).to.be.true;
    expect(fileStat.size).to.be.greaterThan(0);
  });
});
