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
import { isDefaultSpecValue } from '../../../../src/commands/agent/generate/authoring-bundle.js';

describe('Agent Generate Authoring Bundle', () => {
  describe('isDefaultSpecValue', () => {
    it('should return true for "default"', () => {
      expect(isDefaultSpecValue('default')).to.be.true;
    });

    it('should return true for "DEFAULT" (case-insensitive)', () => {
      expect(isDefaultSpecValue('DEFAULT')).to.be.true;
    });

    it('should return true for "Default"', () => {
      expect(isDefaultSpecValue('Default')).to.be.true;
    });

    it('should return true for "  default  " (trimmed)', () => {
      expect(isDefaultSpecValue('  default  ')).to.be.true;
    });

    it('should return false for a file path', () => {
      expect(isDefaultSpecValue('specs/agentSpec.yaml')).to.be.false;
    });

    it('should return false for empty string', () => {
      expect(isDefaultSpecValue('')).to.be.false;
    });

    it('should return false for string that contains "default"', () => {
      expect(isDefaultSpecValue('my-default-spec.yaml')).to.be.false;
    });
  });
});
