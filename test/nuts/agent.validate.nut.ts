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
import { expect } from 'chai';
import { execCmd } from '@salesforce/cli-plugins-testkit';
import { AgentValidateAuthoringBundleResult } from '../../src/commands/agent/validate/authoring-bundle.js';
import { getSharedContext } from './shared-setup.js';

describe('agent validate authoring-bundle NUTs', () => {
  it('should validate a valid authoring bundle', () => {
    const context = getSharedContext();
    const username = context.username;

    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name AgentNUT --target-org ${username} --json`,
      { ensureExitCode: 0 }
    ).jsonOutput?.result;

    expect(result).to.be.ok;
    expect(result?.success).to.be.true;
  });

  it('should fail validation for invalid bundle', () => {
    const context = getSharedContext();
    const username = context.username;
    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name invalid --target-org ${username} --json`,
      { ensureExitCode: 2 }
    ).jsonOutput!;

    expect(result.stack).to.include('Error: Compilation of the Agent Script file failed with the following');
    expect(result.stack).to.include('Auto transitions require a description');
  });

  it('should fail validation for invalid bundle name specified ', () => {
    const context = getSharedContext();
    const username = context.username;
    const result = execCmd<AgentValidateAuthoringBundleResult>(
      `agent validate authoring-bundle --api-name doesNotExist --target-org ${username} --json`,
      { ensureExitCode: 1 }
    ).jsonOutput!;

    expect(result.name).to.equal('AgentNotFoundError');
    expect(result.stack).to.include("file with API name 'doesNotExist' in the DX project");
    expect(result?.actions).to.deep.equal([
      'Check that the API name is correct and that the ".agent" file exists in your DX project directory.',
    ]);
  });
});
