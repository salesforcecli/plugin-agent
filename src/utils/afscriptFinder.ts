/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { type AfScript } from '@salesforce/agents';

/**
 * Finds an .afscript file with the given API name in the project directory.
 * Searches for pattern: any/file/path/authoringbundles/<apiName>/<apiName>.afscript
 *
 * @param projectDir - The root directory to start searching from
 * @param apiName - The API name to search for
 * @returns The full path to the .afscript file if found, undefined otherwise
 */
export function findAndReadAfScript(projectDir: string, apiName: string): AfScript | undefined {
  const walk = (dir: string): string | undefined => {
    const files = readdirSync(dir);

    // If we find authoringbundles dir, check for the expected file structure
    if (files.includes('authoringbundles')) {
      const expectedPath = join(dir, 'authoringbundles', apiName, `${apiName}.afscript`);
      if (statSync(expectedPath, { throwIfNoEntry: false })?.isFile()) {
        return readFileSync(expectedPath, 'utf-8');
      }
    }

    // Otherwise keep searching directories
    for (const file of files) {
      const filePath = join(dir, file);
      if (statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) {
        const found = walk(filePath);
        if (found) return found;
      }
    }
  };

  return walk(projectDir);
}
