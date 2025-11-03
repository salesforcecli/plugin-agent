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

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import type { AgentPreviewSendResponse } from '@salesforce/agents';
import { saveTranscriptsToFile } from '../../src/components/agent-preview-react.js';

describe('AgentPreviewReact saveTranscriptsToFile', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-preview-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create output directory if it does not exist', () => {
    const outputDir = path.join(testDir, 'nested', 'directory');
    const messages: Array<{ timestamp: Date; role: string; content: string }> = [];
    const responses: AgentPreviewSendResponse[] = [];

    saveTranscriptsToFile(outputDir, messages, responses);

    expect(fs.existsSync(outputDir)).to.be.true;
  });

  it('should write transcript.json with messages', () => {
    const outputDir = path.join(testDir, 'output');
    const messages: Array<{ timestamp: Date; role: string; content: string }> = [
      { timestamp: new Date('2025-01-01T00:00:00Z'), role: 'user', content: 'Hello' },
      { timestamp: new Date('2025-01-01T00:00:01Z'), role: 'agent', content: 'Hi there' },
    ];
    const responses: AgentPreviewSendResponse[] = [];

    saveTranscriptsToFile(outputDir, messages, responses);

    const transcriptPath = path.join(outputDir, 'transcript.json');
    expect(fs.existsSync(transcriptPath)).to.be.true;

    const content = JSON.parse(fs.readFileSync(transcriptPath, 'utf8')) as Array<{
      role: string;
      content: string;
    }>;
    expect(content).to.have.lengthOf(2);
    expect(content[0]?.role).to.equal('user');
    expect(content[0]?.content).to.equal('Hello');
    expect(content[1]?.role).to.equal('agent');
    expect(content[1]?.content).to.equal('Hi there');
  });

  it('should write responses.json with responses', () => {
    const outputDir = path.join(testDir, 'output');
    const messages: Array<{ timestamp: Date; role: string; content: string }> = [];
    const responses: AgentPreviewSendResponse[] = [
      {
        messages: [{ message: 'Response 1' }],
      },
      {
        messages: [{ message: 'Response 2' }],
      },
    ] as unknown as AgentPreviewSendResponse[];

    saveTranscriptsToFile(outputDir, messages, responses);

    const responsesPath = path.join(outputDir, 'responses.json');
    expect(fs.existsSync(responsesPath)).to.be.true;

    const content = JSON.parse(fs.readFileSync(responsesPath, 'utf8')) as Array<{
      messages: Array<{ message: string }>;
    }>;
    expect(content).to.have.lengthOf(2);
    expect(content[0]?.messages[0]?.message).to.equal('Response 1');
    expect(content[1]?.messages[0]?.message).to.equal('Response 2');
  });

  it('should write both transcript.json and responses.json', () => {
    const outputDir = path.join(testDir, 'output');
    const messages: Array<{ timestamp: Date; role: string; content: string }> = [
      { timestamp: new Date(), role: 'user', content: 'Test' },
    ];
    const responses: AgentPreviewSendResponse[] = [
      {
        messages: [{ message: 'Test response' }],
      },
    ] as unknown as AgentPreviewSendResponse[];

    saveTranscriptsToFile(outputDir, messages, responses);

    expect(fs.existsSync(path.join(outputDir, 'transcript.json'))).to.be.true;
    expect(fs.existsSync(path.join(outputDir, 'responses.json'))).to.be.true;
  });

  it('should not create files if outputDir is empty string', () => {
    const outputDir = '';
    const messages: Array<{ timestamp: Date; role: string; content: string }> = [
      { timestamp: new Date(), role: 'user', content: 'Test' },
    ];
    const responses: AgentPreviewSendResponse[] = [];

    // Should not throw
    expect(() => saveTranscriptsToFile(outputDir, messages, responses)).to.not.throw();
  });

  it('should format JSON with proper indentation', () => {
    const outputDir = path.join(testDir, 'output');
    const messages: Array<{ timestamp: Date; role: string; content: string }> = [
      { timestamp: new Date('2025-01-01T00:00:00Z'), role: 'user', content: 'Test' },
    ];
    const responses: AgentPreviewSendResponse[] = [];

    saveTranscriptsToFile(outputDir, messages, responses);

    const transcriptPath = path.join(outputDir, 'transcript.json');
    const content = fs.readFileSync(transcriptPath, 'utf8');

    // Should have newlines (pretty-printed JSON)
    expect(content).to.include('\n');
    // Should parse as valid JSON
    expect(() => JSON.parse(content) as unknown).to.not.throw();
  });
});
