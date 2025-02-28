/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global, SfError, TTLConfig } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

type CacheContents = {
  runId: string;
  name: string;
  outputDir?: string;
};

export class AgentTestCache extends TTLConfig<TTLConfig.Options, CacheContents> {
  public static getFileName(): string {
    return 'agent-test-cache.json';
  }

  public static getDefaultOptions(): TTLConfig.Options {
    return {
      isGlobal: true,
      isState: true,
      filename: AgentTestCache.getFileName(),
      stateFolder: Global.SF_STATE_FOLDER,
      ttl: Duration.days(7),
    };
  }

  public async createCacheEntry(runId: string, name: string, outputDir?: string): Promise<void> {
    if (!runId) throw new SfError('runId is required to create a cache entry');

    this.set(runId, { runId, name, outputDir });
    await this.write();
  }

  public async removeCacheEntry(runId: string): Promise<void> {
    if (!runId) throw new SfError('runId is required to remove a cache entry');

    this.unset(runId);
    await this.write();
  }

  public resolveFromCache(): CacheContents {
    const key = this.getLatestKey();
    if (!key) throw new SfError('Could not find a runId to resume');

    return this.get(key);
  }

  public useIdOrMostRecent(
    runId: string | undefined,
    useMostRecent: boolean
  ): { runId: string; name?: string; outputDir?: string } {
    if (runId && useMostRecent) {
      throw new SfError('Cannot specify both a runId and use most recent flag');
    }

    if (!runId && !useMostRecent) {
      throw new SfError('Must specify either a runId or use most recent flag');
    }

    if (runId) {
      return this.has(runId) ? this.get(runId) : { runId };
    }

    return this.resolveFromCache();
  }
}
