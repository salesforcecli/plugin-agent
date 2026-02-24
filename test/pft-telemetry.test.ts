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

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

describe('PFT telemetry configuration', () => {
  it('package.json has enableO11y and productFeatureId override', () => {
    const fileDir = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(fileDir, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;

    expect(packageJson?.enableO11y, 'enableO11y should be true for PFT telemetry').to.equal(true);
    expect(packageJson?.productFeatureId, 'productFeatureId should be aJCEE0000007rcH4AQ').to.equal(
      'aJCEE0000007rcH4AQ'
    );
  });
});
