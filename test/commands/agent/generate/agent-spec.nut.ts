/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { AgentCreateSpecResult } from '../../../../src/commands/agent/generate/agent-spec.js';
import { AgentCreateResult } from '../../../../src/commands/agent/create.js';

describe('agent generate spec NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { name: 'agentGenerateSpec' },
    });
    // if we're creating agent enabled scratch orgs programmatically, we'll have to assign the permset as a step
    // since we're creating them by hand, it'll be done, and reassigning, will cause non-zero exit
    // execCmd(`org assign permset -n CopilotSalesforceAdminPSG --target-org ${session.hubOrg.username}`, {
    //   ensureExitCode: 0,
    // });
  });

  after(async () => {
    await session?.clean();
  });

  it('should write yaml spec file with minimal flags', async () => {
    // TODO: since we're not creating scratch orgs / NUT
    // we've created a sandbox from na40, so all tests will be run against that, as the '.hubOrg'
    const targetOrg = `--target-org ${session.hubOrg.username}`;
    const type = 'customer';
    const role = 'test agent role';
    const companyName = 'Test Company Name';
    const companyDescription = 'Test Company Description';
    const companyWebsite = 'https://test-company-website.org';
    const command = `agent generate agent-spec ${targetOrg} --type ${type} --role "${role}" --company-name "${companyName}" --company-description "${companyDescription}" --company-website ${companyWebsite} --json`;
    const output = execCmd<AgentCreateSpecResult>(command, {
      ensureExitCode: 0,
    }).jsonOutput;

    const expectedFilePath = resolve(session.project.dir, 'specs', 'agentSpec.yaml');
    expect(output?.result.isSuccess).to.be.true;
    expect(output?.result.specPath).to.equal(expectedFilePath);
    expect(output?.result.agentType).to.equal(type);
    expect(output?.result.role).to.equal(role);
    expect(output?.result.companyName).to.equal(companyName);
    expect(output?.result.companyDescription).to.equal(companyDescription);
    expect(output?.result.topics).to.be.an('array').with.lengthOf(5);
    const fileStat = statSync(expectedFilePath);
    expect(fileStat.isFile()).to.be.true;
    expect(fileStat.size).to.be.greaterThan(0);
  });

  it('should create new agent in org', async () => {
    const name = `myAgent${Date.now().toString()}`;
    const result = execCmd<AgentCreateResult>(
      `agent create --spec ${resolve(session.project.dir, 'specs', 'agentSpec.yaml')} --target-org ${
        session.hubOrg.username
      } --agent-name ${name} --agent-api-name ${name} --json`
    ).jsonOutput?.result;
    expect(result).to.be.ok;
    expect(result?.agentDefinition.sampleUtterances.length).to.be.greaterThanOrEqual(1);
  });
});
