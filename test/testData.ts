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
import { PlannerResponse } from '@salesforce/agents/lib/types.js';

export const trace1: PlannerResponse = {
  type: 'PlanSuccessResponse',
  planId: 'plan-1',
  sessionId: 'session-123',
  intent: 'get_weather',
  topic: 'weather',
  plan: [
    {
      type: 'FunctionStep',
      function: {
        name: 'get_weather',
        input: { location: 'Madrid' },
        output: { temperature: 25, condition: 'sunny' },
      },
      executionLatency: 100,
      startExecutionTime: Date.now(),
      endExecutionTime: Date.now() + 100,
    },
  ],
};

export const trace2: PlannerResponse = {
  type: 'PlanSuccessResponse',
  planId: 'plan-4',
  sessionId: 'session-456',
  intent: 'send_message',
  topic: 'communication',
  plan: [
    {
      type: 'PlannerResponseStep',
      message: 'Hello world',
      responseType: 'text',
      isContentSafe: true,
      safetyScore: {
        // eslint-disable-next-line camelcase
        safety_score: 0.9,
        // eslint-disable-next-line camelcase
        category_scores: {
          toxicity: 0.1,
          hate: 0.0,
          identity: 0.0,
          violence: 0.0,
          physical: 0.0,
          sexual: 0.0,
          profanity: 0.0,
          biased: 0.0,
        },
      },
    },
  ],
};
