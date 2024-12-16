/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { AgentTestDetailsResponse, jsonFormat, humanFormat, junitFormat, tapFormat } from '@salesforce/agents';
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
  results: AgentTestDetailsResponse | undefined;
  jsonEnabled: boolean;
  outputDir?: string;
}): Promise<void> {
  if (!results) {
    // do nothing since there are no results to handle
    return;
  }

  const ux = new Ux({ jsonEnabled });

  if (format === 'human') {
    const formatted = await humanFormat(results);
    ux.log(formatted);
    if (outputDir) {
      await writeFileToDir(outputDir, `test-result-${id}.txt`, formatted);
    }
  }

  if (format === 'json') {
    const formatted = await jsonFormat(results);
    ux.log(formatted);
    if (outputDir) {
      await writeFileToDir(outputDir, `test-result-${id}.json`, formatted);
    }
  }

  if (format === 'junit') {
    const formatted = await junitFormat(results);
    ux.log(formatted);
    if (outputDir) {
      await writeFileToDir(outputDir, `test-result-${id}.xml`, formatted);
    }
  }

  if (format === 'tap') {
    const formatted = await tapFormat(results);
    ux.log(formatted);
    if (outputDir) {
      await writeFileToDir(outputDir, `test-result-${id}.txt`, formatted);
    }
  }
}
