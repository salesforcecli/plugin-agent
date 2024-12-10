/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import sinon from 'sinon';
import { AgentTestCache } from '../src/agentTestCache.js';

describe('AgentTestCache', () => {
  let cache: AgentTestCache;

  beforeEach(() => {
    cache = new AgentTestCache(AgentTestCache.getDefaultOptions());
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createCacheEntry', () => {
    it('should create a cache entry', async () => {
      const writeStub = sinon.stub(cache, 'write').resolves();
      await cache.createCacheEntry('123', 'testName');
      const entry = cache.get('123');
      expect(entry.aiEvaluationId).to.equal('123');
      expect(entry.name).to.equal('testName');
      expect(writeStub.calledOnce).to.be.true;
    });

    it('should throw an error if aiEvaluationId is not provided', async () => {
      try {
        await cache.createCacheEntry('', 'testName');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).message).to.equal('aiEvaluationId is required to create a cache entry');
      }
    });
  });

  describe('removeCacheEntry', () => {
    it('should remove a cache entry', async () => {
      const writeStub = sinon.stub(cache, 'write').resolves();
      await cache.createCacheEntry('123', 'testName');
      await cache.removeCacheEntry('123');
      expect(cache.get('123')).to.be.undefined;
      expect(writeStub.calledTwice).to.be.true;
    });

    it('should throw an error if aiEvaluationId is not provided', async () => {
      try {
        await cache.removeCacheEntry('');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).message).to.equal('aiEvaluationId is required to remove a cache entry');
      }
    });
  });

  describe('resolveFromCache', () => {
    it('should resolve the most recent cache entry', async () => {
      sinon.stub(cache, 'getLatestKey').returns('123');
      await cache.createCacheEntry('123', 'testName');
      const result = cache.resolveFromCache();
      expect(result.aiEvaluationId).to.equal('123');
      expect(result.name).to.equal('testName');
    });

    it('should throw an error if no cache entry is found', () => {
      sinon.stub(cache, 'getLatestKey').returns(undefined);
      try {
        cache.resolveFromCache();
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).message).to.equal('Could not find an aiEvaluationId to resume');
      }
    });
  });

  describe('useIdOrMostRecent', () => {
    it('should return the provided aiEvaluationId', () => {
      const result = cache.useIdOrMostRecent('123', false);
      expect(result).to.deep.equal({ aiEvaluationId: '123' });
    });

    it('should return the most recent cache entry', async () => {
      sinon.stub(cache, 'resolveFromCache').returns({ aiEvaluationId: '123', name: 'testName' });
      const result = cache.useIdOrMostRecent(undefined, true);
      expect(result).to.deep.equal({ aiEvaluationId: '123', name: 'testName' });
    });

    it('should throw an error if both aiEvaluationId and useMostRecent are provided', () => {
      try {
        cache.useIdOrMostRecent('123', true);
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).message).to.equal('Cannot specify both an aiEvaluationId and use most recent flag');
      }
    });

    it('should throw an error if neither aiEvaluationId nor useMostRecent are provided', () => {
      try {
        cache.useIdOrMostRecent(undefined, false);
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).message).to.equal('Must specify either an aiEvaluationId or use most recent flag');
      }
    });
  });
});
