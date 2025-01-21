/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { AgentTestResultsResponse, convertTestResultsToFormat } from '@salesforce/agents';
import { Ux } from '@salesforce/sf-plugins-core/Ux';

async function writeFileToDir(outputDir: string, fileName: string, content: string): Promise<void> {
  // if directory doesn't exist, create it
  await mkdir(outputDir, { recursive: true });

  await writeFile(join(outputDir, fileName), content);
}

export async function handleTestResults({
  id,
  format,
  results,
  jsonEnabled,
  outputDir,
}: {
  id: string;
  format: 'human' | 'json' | 'junit' | 'tap';
  results: AgentTestResultsResponse | undefined;
  jsonEnabled: boolean;
  outputDir?: string;
}): Promise<void> {
  if (!results) {
    // do nothing since there are no results to handle
    return;
  }

  const ux = new Ux({ jsonEnabled });

  if (format === 'human') {
    const formatted = await convertTestResultsToFormat(results, 'human');
    if (outputDir) {
      const file = `test-result-${id}.txt`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created human-readable file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }

  if (format === 'json') {
    const formatted = await convertTestResultsToFormat(results, 'json');
    if (outputDir) {
      const file = `test-result-${id}.json`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created JSON file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }

  if (format === 'junit') {
    const formatted = await convertTestResultsToFormat(results, 'junit');
    if (outputDir) {
      const file = `test-result-${id}.xml`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created JUnit file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }

  if (format === 'tap') {
    const formatted = await convertTestResultsToFormat(results, 'tap');
    if (outputDir) {
      const file = `test-result-${id}.txt`;
      await writeFileToDir(outputDir, file, formatted);
      ux.log(`Created TAP file at ${join(outputDir, file)}`);
    } else {
      ux.log(formatted);
    }
  }
}
