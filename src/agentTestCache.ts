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

import { Global, SfError, TTLConfig } from '@salesforce/core';
import { Duration } from '@salesforce/kit';

type ResultFormat = 'json' | 'human' | 'junit' | 'tap';

type CacheContents = {
  runId: string;
  name: string;
  outputDir?: string;
  resultFormat?: ResultFormat;
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

  public async createCacheEntry(
    runId: string,
    name: string,
    outputDir?: string,
    resultFormat?: ResultFormat
  ): Promise<void> {
    if (!runId) throw new SfError('runId is required to create a cache entry');

    this.set(runId, { runId, name, outputDir, resultFormat });
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
  ): { runId: string; name?: string; outputDir?: string; resultFormat?: ResultFormat } {
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
