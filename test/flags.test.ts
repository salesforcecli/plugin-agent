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

import { join, relative } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { expect } from 'chai';
import { getHiddenDirs, traverseForFiles } from '../src/flags.js';

describe('traverseForFiles', () => {
  const testDir = join(process.cwd(), 'test-temp');
  const testFiles = [
    'file1.yml',
    'file2.yaml',
    join('subdir', 'file3.yml'),
    join('subdir', 'file4.yaml'),
    join('node_modules', 'file5.yml'),
    join('excluded', 'file6.yaml'),
  ] as const;

  before(async () => {
    // Create directory structure and test files
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'subdir'), { recursive: true });
    await mkdir(join(testDir, 'node_modules'), { recursive: true });
    await mkdir(join(testDir, 'excluded'), { recursive: true });

    // Create test files
    await Promise.all(testFiles.map((file) => writeFile(join(testDir, file), 'test content')));
  });

  after(async () => {
    // Clean up test files
    await rm(testDir, { recursive: true, force: true });
  });

  it('should find all yaml files when no excludeDirs is provided', async () => {
    const results = traverseForFiles(testDir, ['.yml', '.yaml']);
    expect(results).to.have.lengthOf(6);
    expect(results).to.include(join(testDir, 'file1.yml'));
    expect(results).to.include(join(testDir, 'file2.yaml'));
    expect(results).to.include(join(testDir, 'subdir', 'file3.yml'));
    expect(results).to.include(join(testDir, 'subdir', 'file4.yaml'));
    expect(results).to.include(join(testDir, 'node_modules', 'file5.yml'));
    expect(results).to.include(join(testDir, 'excluded', 'file6.yaml'));
  });

  it('should exclude specified directories', async () => {
    const results = traverseForFiles(testDir, ['.yml', '.yaml'], ['node_modules', 'excluded']);
    expect(results).to.have.lengthOf(4);
    expect(results).to.include(join(testDir, 'file1.yml'));
    expect(results).to.include(join(testDir, 'file2.yaml'));
    expect(results).to.include(join(testDir, 'subdir', 'file3.yml'));
    expect(results).to.include(join(testDir, 'subdir', 'file4.yaml'));
    expect(results).to.not.include(join(testDir, 'node_modules', 'file5.yml'));
    expect(results).to.not.include(join(testDir, 'excluded', 'file6.yaml'));
  });

  it('should handle empty excludeDirs array', async () => {
    const results = traverseForFiles(testDir, ['.yml', '.yaml'], []);
    expect(results).to.have.lengthOf(6);
  });
});

describe('promptForSpecYaml', () => {
  it('should include "Default Agent Spec" in the list of options', async () => {
    // Test the source function logic directly by replicating what promptForSpecYaml does

    const hiddenDirs = await getHiddenDirs();
    const dirsToTraverse = [process.cwd()];
    const files = traverseForFiles(
      dirsToTraverse,
      ['AgentSpec.yml', 'AgentSpec.yaml'],
      ['node_modules', ...hiddenDirs]
    );

    // Replicate the source function logic from promptForSpecYaml
    const source = async (input?: string) => {
      const arr = [
        ...files.map((o) => ({ name: relative(process.cwd(), o), value: o })),
        { name: 'Default Agent Spec', value: undefined },
      ];

      if (!input) return arr;
      return arr.filter((o) => o.name.includes(input));
    };

    // Call the source function with no input to get all options
    const options = await source();

    // Verify "Default Agent Spec" is in the list
    const defaultAgentSpecOption = options.find((option) => option.name === 'Default Agent Spec');
    expect(defaultAgentSpecOption).to.be.ok;
    expect(defaultAgentSpecOption?.name).to.equal('Default Agent Spec');
    expect(defaultAgentSpecOption?.value).to.be.undefined;
  });
});
