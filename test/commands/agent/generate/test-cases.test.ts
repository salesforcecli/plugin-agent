/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { type TestSetInputs, constructTestSetXML } from '../../../../src/commands/agent/generate/test-cases.js';

describe('constructTestSetXML', () => {
  it('should return a valid test set XML', () => {
    const testCases = [
      {
        utterance: 'hello',
        actionSequenceExpectedValue: ['foo', 'bar'],
        botRatingExpectedValue: 'baz',
        topicSequenceExpectedValue: 'qux',
      },
      {
        utterance: 'goodbye',
        actionSequenceExpectedValue: ['foo', 'bar'],
        botRatingExpectedValue: 'baz',
        topicSequenceExpectedValue: 'qux',
      },
      {
        utterance: 'how are you',
        actionSequenceExpectedValue: ['foo', 'bar'],
        botRatingExpectedValue: 'baz',
        topicSequenceExpectedValue: 'qux',
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
    <expectation>
      <name>topic_sequence_match</name>
      <expectedValue>qux</expectedValue>
    </expectation>
    <expectation>
      <name>action_sequence_match</name>
      <expectedValue>["foo","bar"]</expectedValue>
    </expectation>
    <expectation>
      <name>bot_response_rating</name>
      <expectedValue>baz</expectedValue>
    </expectation>
  </testCase>
  <testCase>
    <number>2</number>
    <inputs>
      <utterance>goodbye</utterance>
    </inputs>
    <expectation>
      <name>topic_sequence_match</name>
      <expectedValue>qux</expectedValue>
    </expectation>
    <expectation>
      <name>action_sequence_match</name>
      <expectedValue>["foo","bar"]</expectedValue>
    </expectation>
    <expectation>
      <name>bot_response_rating</name>
      <expectedValue>baz</expectedValue>
    </expectation>
  </testCase>
  <testCase>
    <number>3</number>
    <inputs>
      <utterance>how are you</utterance>
    </inputs>
    <expectation>
      <name>topic_sequence_match</name>
      <expectedValue>qux</expectedValue>
    </expectation>
    <expectation>
      <name>action_sequence_match</name>
      <expectedValue>["foo","bar"]</expectedValue>
    </expectation>
    <expectation>
      <name>bot_response_rating</name>
      <expectedValue>baz</expectedValue>
    </expectation>
  </testCase>
</AiEvaluationTestSet>`);
  });
});
