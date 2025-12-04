/*
 * Copyright 2025, Salesforce, Inc.
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
import { type CompilationError } from '@salesforce/agents';
import AgentValidateAuthoringBundle, {
  type AgentValidateAuthoringBundleResult,
} from '../../../../src/commands/agent/validate/authoring-bundle.js';
import { throwAgentCompilationError } from '../../../../src/common.js';

describe('Agent Validate Authoring Bundle', () => {
  describe('prompt configuration', () => {
    it('should have correct prompt messages', () => {
      const prompts = AgentValidateAuthoringBundle['FLAGGABLE_PROMPTS'];

      expect(prompts['api-name'].message).to.equal(
        'API name of the authoring bundle you want to validate; if not specified, the command provides a list that you can choose from.'
      );
      expect(prompts['api-name'].promptMessage).to.equal('API name of the authoring bundle to validate');
    });
  });

  describe('command result type', () => {
    it('should export correct result type', () => {
      const result: AgentValidateAuthoringBundleResult = {
        success: true,
      };
      expect(result.success).to.be.true;
      expect(result.errors).to.be.undefined;
    });

    it('should support error result type', () => {
      const result: AgentValidateAuthoringBundleResult = {
        success: false,
        errors: ['Compilation failed', 'Invalid syntax'],
      };
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal(['Compilation failed', 'Invalid syntax']);
    });
  });

  describe('throwAgentCompilationError utility', () => {
    it('should throw SfError with compilation errors', () => {
      const errors: CompilationError[] = [
        {
          errorType: 'SyntaxError',
          description: 'Invalid syntax',
          lineStart: 10,
          colStart: 5,
          lineEnd: 10,
          colEnd: 10,
        },
        { errorType: 'SyntaxError', description: 'Unknown error', lineStart: 15, colStart: 1, lineEnd: 15, colEnd: 5 },
      ];

      try {
        throwAgentCompilationError(errors);
        expect.fail('Expected function to throw an error');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        expect((error as SfError).name).to.equal('CompileAgentScriptError');
        expect((error as SfError).message).to.include('SyntaxError: Invalid syntax [Ln 10, Col 5]');
        expect((error as SfError).message).to.include('SyntaxError: Unknown error [Ln 15, Col 1]');
      }
    });

    it('should handle empty error array', () => {
      try {
        throwAgentCompilationError([]);
        expect.fail('Expected function to throw an error');
      } catch (error) {
        expect(error).to.be.instanceOf(SfError);
        expect((error as SfError).name).to.equal('CompileAgentScriptError');
        expect((error as SfError).message).to.equal('Unknown compilation error occurred');
      }
    });
  });
});
