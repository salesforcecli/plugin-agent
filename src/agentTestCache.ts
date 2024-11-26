/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global, SfError, TTLConfig } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

export class AgentTestCache extends TTLConfig<TTLConfig.Options, { jobId: string }> {
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

  public async createCacheEntry(jobId: string): Promise<void> {
    if (!jobId) throw new SfError('Job ID is required to create a cache entry');

    this.set(jobId, { jobId });
    await this.write();
  }

  public async removeCacheEntry(jobId: string): Promise<void> {
    if (!jobId) throw new SfError('Job ID is required to remove a cache entry');

    this.unset(jobId);
    await this.write();
  }

  public resolveFromCache(): { jobId: string } {
    const key = this.getLatestKey();
    if (!key) throw new SfError('Could not find a job ID to resume');

    const { jobId } = this.get(key);
    return { jobId };
  }

  public useIdOrMostRecent(id: string | undefined, useMostRecent: boolean): string {
    if (id && useMostRecent) {
      throw new SfError('Cannot specify both a job ID and use most recent flag');
    }

    if (!id && !useMostRecent) {
      throw new SfError('Must specify either a job ID or use most recent flag');
    }

    if (id) {
      return id;
    }

    return this.resolveFromCache().jobId;
  }
}
