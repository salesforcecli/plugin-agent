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
import type { CompilationError } from '@salesforce/agents';
import { throwAgentCompilationError, COMPILATION_API_EXIT_CODES } from '../src/common.js';

describe('common', () => {
  describe('COMPILATION_API_EXIT_CODES', () => {
    it('should re-export COMPILATION_API_EXIT_CODES from @salesforce/agents', () => {
      expect(COMPILATION_API_EXIT_CODES).to.be.an('object');
    });
  });

  describe('throwAgentCompilationError', () => {
    it('should throw SfError with unknown error message when given empty array', () => {
      try {
        throwAgentCompilationError([]);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).name).to.equal('CompileAgentScriptError');
        expect((e as SfError).message).to.equal('Unknown compilation error occurred');
        expect((e as SfError).exitCode).to.equal(1);
      }
    });

    it('should throw SfError with formatted error message for single error', () => {
      const errors: CompilationError[] = [
        {
          errorType: 'SyntaxError',
          description: 'Unexpected token',
          lineStart: 5,
          colStart: 10,
          lineEnd: 5,
          colEnd: 15,
        },
      ];

      try {
        throwAgentCompilationError(errors);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        expect((e as SfError).message).to.equal('SyntaxError: Unexpected token [Ln 5, Col 10]');
        expect((e as SfError).exitCode).to.equal(1);
      }
    });

    it('should join multiple errors with EOL separator', () => {
      const errors: CompilationError[] = [
        {
          errorType: 'SyntaxError',
          description: 'Unexpected token',
          lineStart: 5,
          colStart: 10,
          lineEnd: 5,
          colEnd: 15,
        },
        {
          errorType: 'TypeError',
          description: 'Cannot read property',
          lineStart: 12,
          colStart: 3,
          lineEnd: 12,
          colEnd: 20,
        },
      ];

      try {
        throwAgentCompilationError(errors);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(SfError);
        const msg = (e as SfError).message;
        expect(msg).to.include('SyntaxError: Unexpected token [Ln 5, Col 10]');
        expect(msg).to.include('TypeError: Cannot read property [Ln 12, Col 3]');
      }
    });

    it('should always set exitCode to 1', () => {
      const errors: CompilationError[] = [
        { errorType: 'AnyError', description: 'Something failed', lineStart: 1, colStart: 1, lineEnd: 1, colEnd: 5 },
      ];

      try {
        throwAgentCompilationError(errors);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        expect((e as SfError).exitCode).to.equal(1);
      }
    });

    it('should always set error name to CompileAgentScriptError', () => {
      try {
        throwAgentCompilationError([]);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        expect((e as SfError).name).to.equal('CompileAgentScriptError');
      }
    });

    it('should include errors array in data for non-empty input', () => {
      const errors: CompilationError[] = [
        { errorType: 'SyntaxError', description: 'Bad token', lineStart: 1, colStart: 1, lineEnd: 1, colEnd: 5 },
      ];

      try {
        throwAgentCompilationError(errors);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        const sfErr = e as SfError;
        expect(sfErr.data).to.deep.equal({ errors });
      }
    });

    it('should include empty array in data for empty input', () => {
      try {
        throwAgentCompilationError([]);
        expect.fail('Expected error to be thrown');
      } catch (e) {
        const sfErr = e as SfError;
        expect(sfErr.data).to.deep.equal([]);
      }
    });
  });
});
