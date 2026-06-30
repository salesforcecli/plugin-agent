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

import { expect } from 'chai';
import { SfError } from '@salesforce/core';
import { extractApiError } from '../src/adlUtils.js';

describe('adlUtils', () => {
  describe('extractApiError', () => {
    it('should extract errorCode and message from error.data array', () => {
      const error = new SfError('something failed') as SfError & { data?: unknown };
      error.data = [{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }];

      const result = extractApiError(error);
      expect(result).to.equal('NOT_FOUND: The requested resource does not exist');
    });

    it('should extract from cause.data array', () => {
      const cause = new Error('inner') as Error & { data?: unknown };
      cause.data = [{ errorCode: 'INVALID_INPUT', message: 'Developer name is invalid' }];
      const error = new SfError('outer', 'OuterError', [], 1, cause);

      const result = extractApiError(error);
      expect(result).to.equal('INVALID_INPUT: Developer name is invalid');
    });

    it('should parse JSON string body from error.data', () => {
      const error = new SfError('failed') as SfError & { data?: unknown };
      error.data = JSON.stringify([{ errorCode: 'DUPLICATE', message: 'Already exists' }]);

      const result = extractApiError(error);
      expect(result).to.equal('DUPLICATE: Already exists');
    });

    it('should strip Java stack traces from message', () => {
      const msg =
        'Something went wrong\n\tat com.salesforce.Foo.bar(Foo.java:42)\n\tat com.salesforce.Baz.run(Baz.java:10)';
      const error = new SfError(msg);

      const result = extractApiError(error);
      expect(result).to.equal('Something went wrong');
    });

    it('should return undefined when no extractable error info', () => {
      const error = new SfError('generic error');

      const result = extractApiError(error);
      expect(result).to.be.undefined;
    });

    it('should return undefined for non-JSON string data', () => {
      const error = new SfError('failed') as SfError & { data?: unknown };
      error.data = 'not json at all';

      const result = extractApiError(error);
      expect(result).to.be.undefined;
    });

    it('should handle empty array in data', () => {
      const error = new SfError('failed') as SfError & { data?: unknown };
      error.data = [];

      const result = extractApiError(error);
      expect(result).to.be.undefined;
    });

    it('should prefer error.data over cause.data', () => {
      const cause = new Error('inner') as Error & { data?: unknown };
      cause.data = [{ errorCode: 'CAUSE_CODE', message: 'from cause' }];
      const error = new SfError('outer', 'OuterError', [], 1, cause) as SfError & { data?: unknown };
      error.data = [{ errorCode: 'ERROR_CODE', message: 'from error' }];

      const result = extractApiError(error);
      expect(result).to.equal('ERROR_CODE: from error');
    });
  });
});
