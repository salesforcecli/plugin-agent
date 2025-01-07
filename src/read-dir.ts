/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readdir } from 'node:fs/promises';
export async function readDir(path: string): Promise<string[]> {
  try {
    return (await readdir(path)).filter((bot) => !bot.startsWith('.'));
  } catch {
    return [];
  }
}
