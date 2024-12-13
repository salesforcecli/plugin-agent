/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { type TestSetInputs, constructTestSetXML } from '../../../../src/commands/agent/generate/testset.js';

describe('constructTestSetXML', () => {
  it('should return a valid test set XML', () => {
    const testCases = [
      {
        utterance: 'hello',
        expectationType: 'topic_sequence_match',
        expectedValue: 'greeting',
      },
      {
        utterance: 'goodbye',
        expectationType: 'action_sequence_match',
        expectedValue: 'farewell,seeya',
      },
      {
        utterance: 'how are you',
        expectationType: 'bot_response_rating',
        expectedValue: '.5',
      },
    ] satisfies TestSetInputs[];

    const xml = constructTestSetXML(testCases);

    expect(xml).to.equal(`<?xml version="1.0" encoding="UTF-8"?>
<AiEvaluationTestSet>
  <subjectType>AGENT</subjectType>
  <testCase>
    <number>1</number>
    <inputs>
      <utterance>hello</utterance>
    </inputs>
    <expectations>
      <expectation>
        <name>topic_sequence_match</name>
        <expectedValue>greeting</expectedValue>
      </expectation>
    </expectations>
  </testCase>
  <testCase>
    <number>2</number>
    <inputs>
      <utterance>goodbye</utterance>
    </inputs>
    <expectations>
      <expectation>
        <name>action_sequence_match</name>
        <expectedValue>["farewell","seeya"]</expectedValue>
      </expectation>
    </expectations>
  </testCase>
  <testCase>
    <number>3</number>
    <inputs>
      <utterance>how are you</utterance>
    </inputs>
    <expectations>
      <expectation>
        <name>bot_response_rating</name>
        <expectedValue>.5</expectedValue>
      </expectation>
    </expectations>
  </testCase>
</AiEvaluationTestSet>`);
  });
});
