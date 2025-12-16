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

import { initializeSharedContext, cleanupSharedContext } from './shared-setup.js';

// Root-level before hook runs before all test suites
before(async () => {
  // Initialize the shared scratch org and setup
  await initializeSharedContext();
});

// Root-level after hook runs after all test suites
after(async () => {
  // Clean up the shared scratch org
  await cleanupSharedContext();
});

// Import all test suites - they will run sequentially
// Order: generate -> validate -> publish -> other agent tests
import './agent.generate.authoring-bundle.nut.js';
import './agent.validate.nut.js';
import './agent.publish.nut.js';
import './agent.nut.js';
