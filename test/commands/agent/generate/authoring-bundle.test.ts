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
import { isNoSpecValue } from '../../../../src/commands/agent/generate/authoring-bundle.js';

describe('Agent Generate Authoring Bundle', () => {
  describe('isNoSpecValue', () => {
    it('should return true for "none"', () => {
      expect(isNoSpecValue('none')).to.be.true;
    });

    it('should return true for "NONE" (case-insensitive)', () => {
      expect(isNoSpecValue('NONE')).to.be.true;
    });

    it('should return true for "None"', () => {
      expect(isNoSpecValue('None')).to.be.true;
    });

    it('should return true for "  none  " (trimmed)', () => {
      expect(isNoSpecValue('  none  ')).to.be.true;
    });

    it('should return false for a file path', () => {
      expect(isNoSpecValue('specs/agentSpec.yaml')).to.be.false;
    });

    it('should return false for empty string', () => {
      expect(isNoSpecValue('')).to.be.false;
    });

    it('should return false for string that contains "none" but is not exactly it', () => {
      expect(isNoSpecValue('path/none-spec-file.yaml')).to.be.false;
    });
  });
});
