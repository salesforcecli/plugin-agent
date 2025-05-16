/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { expect } from 'chai';
import { traverseForFiles } from '../src/flags.js';

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
    const results = await traverseForFiles(testDir, ['.yml', '.yaml']);
    expect(results).to.have.lengthOf(6);
    expect(results).to.include(join(testDir, 'file1.yml'));
    expect(results).to.include(join(testDir, 'file2.yaml'));
    expect(results).to.include(join(testDir, 'subdir', 'file3.yml'));
    expect(results).to.include(join(testDir, 'subdir', 'file4.yaml'));
    expect(results).to.include(join(testDir, 'node_modules', 'file5.yml'));
    expect(results).to.include(join(testDir, 'excluded', 'file6.yaml'));
  });

  it('should exclude specified directories', async () => {
    const results = await traverseForFiles(testDir, ['.yml', '.yaml'], ['node_modules', 'excluded']);
    expect(results).to.have.lengthOf(4);
    expect(results).to.include(join(testDir, 'file1.yml'));
    expect(results).to.include(join(testDir, 'file2.yaml'));
    expect(results).to.include(join(testDir, 'subdir', 'file3.yml'));
    expect(results).to.include(join(testDir, 'subdir', 'file4.yaml'));
    expect(results).to.not.include(join(testDir, 'node_modules', 'file5.yml'));
    expect(results).to.not.include(join(testDir, 'excluded', 'file6.yaml'));
  });

  it('should handle empty excludeDirs array', async () => {
    const results = await traverseForFiles(testDir, ['.yml', '.yaml'], []);
    expect(results).to.have.lengthOf(6);
  });
});
