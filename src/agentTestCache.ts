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
  name: string;
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

  public async createCacheEntry(aiEvaluationId: string, name: string): Promise<void> {
    if (!aiEvaluationId) throw new SfError('aiEvaluationId is required to create a cache entry');

    this.set(aiEvaluationId, { aiEvaluationId, name });
    await this.write();
  }

  public async removeCacheEntry(aiEvaluationId: string): Promise<void> {
    if (!aiEvaluationId) throw new SfError('aiEvaluationId is required to remove a cache entry');

    this.unset(aiEvaluationId);
    await this.write();
  }

  public resolveFromCache(): CacheContents {
    const key = this.getLatestKey();
    if (!key) throw new SfError('Could not find an aiEvaluationId to resume');

    return this.get(key);
  }

  public useIdOrMostRecent(
    aiEvaluationId: string | undefined,
    useMostRecent: boolean
  ): { aiEvaluationId: string; name?: string } {
    if (aiEvaluationId && useMostRecent) {
      throw new SfError('Cannot specify both an aiEvaluationId and use most recent flag');
    }

    if (!aiEvaluationId && !useMostRecent) {
      throw new SfError('Must specify either an aiEvaluationId or use most recent flag');
    }

    if (aiEvaluationId) {
      return { aiEvaluationId };
    }

    return this.resolveFromCache();
  }
}