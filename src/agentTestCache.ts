/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global, SfError, TTLConfig } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

type CacheContents = {
  aiEvaluationId: string;
  jobId: string;
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

  public async createCacheEntry(jobId: string, aiEvaluationId: string): Promise<void> {
    if (!jobId) throw new SfError('Job ID is required to create a cache entry');

    this.set(jobId, { aiEvaluationId, jobId });
    await this.write();
  }

  public async removeCacheEntry(jobId: string): Promise<void> {
    if (!jobId) throw new SfError('Job ID is required to remove a cache entry');

    this.unset(jobId);
    await this.write();
  }

  public resolveFromCache(): CacheContents {
    const key = this.getLatestKey();
    if (!key) throw new SfError('Could not find a job ID to resume');

    return this.get(key);
  }

  public useIdOrMostRecent(
    jobId: string | undefined,
    useMostRecent: boolean
  ): { jobId: string; aiEvaluationId?: string } {
    if (jobId && useMostRecent) {
      throw new SfError('Cannot specify both a job ID and use most recent flag');
    }

    if (!jobId && !useMostRecent) {
      throw new SfError('Must specify either a job ID or use most recent flag');
    }

    if (jobId) {
      return { jobId };
    }

    return this.resolveFromCache();
  }
}
