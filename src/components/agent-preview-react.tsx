/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import React from 'react';
import { Box, Text } from 'ink';
import figures from '@inquirer/figures';
import TextInput from 'ink-text-input';
import { AgentPreview, AgentPreviewSendResponse } from '@salesforce/agents';
import { sleep } from '@salesforce/kit';

// TODO:
// - [ ] Add a way to end the session
// -     [ ] On exit, notify that the transcript and results have been saved
// - [x] Fix timestamp on Typing
// - [ ] Break this into more components
// - [ ] Flashing in iterm2
// - [x] Correct the content width calculation
// - [x] Add a way to save the transcript to a file
// - [x] Add a way to save API results to a file
// - [ ] If you ask to be connected with a human, then messages[0].message is empty...
// -     [ ] It looks like if the type is Escalate, then the next message is empty
// - [ ] Add the response type on the AgentResponse

// Component to show a simple typing animation
function Typing(): React.ReactNode {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % 4);
    }, 350);

    return () => clearInterval(timer);
  }, []);

  const colors = ['grey', 'grey', 'grey'];
  colors[frame] = 'white';

  return (
    <Text>
      <Text color={colors[0]}>.</Text>
      <Text color={colors[1]}>.</Text>
      <Text color={colors[2]}>.</Text>
    </Text>
  );
}

// We split the content on newlines, then find the longest array element
const calculateWidth = (content: string): number =>
  content.split('\n').reduce((acc, line) => Math.max(acc, line.length), 0) + 4;

const saveTranscriptsToFile = (
  tempDir: string,
  messages: Array<{ timestamp: Date; role: string; content: string }>,
  responses: AgentPreviewSendResponse[]
): void => {
  if (!tempDir) return;
  fs.mkdirSync(tempDir, { recursive: true });

  const transcriptPath = path.join(tempDir, 'transcript.json');
  fs.writeFileSync(transcriptPath, JSON.stringify(messages, null, 2));

  const responsesPath = path.join(tempDir, 'responses.json');
  fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
};

/**
 * Ideas:
 * - Limit height based on terminal height
 * - Add keystroke to clear chat
 * - Add keystroke to scroll up
 * - Add keystroke to scroll down
 */
export function AgentPreviewReact(props: {
  readonly agent: AgentPreview;
  readonly id: string;
  readonly name: string;
}): React.ReactNode {
  const [messages, setMessages] = React.useState<Array<{ timestamp: Date; role: string; content: string }>>([]);
  const [header, setHeader] = React.useState('Starting session...');
  const [sessionId, setSessionId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(true);
  // @ts-expect-error: Not sure why this is required
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [timestamp, setTimestamp] = React.useState(new Date().getTime());
  const [tempDir, setTempDir] = React.useState('');
  // TODO: Fix type
  const [responses, setResponses] = React.useState<AgentPreviewSendResponse[]>([]);

  const { agent, id, name } = props;

  React.useEffect(() => {
    const startSession = async (): Promise<void> => {
      const session = await agent.start(id);
      setSessionId(session.sessionId);
      setHeader(`New session started with "${props.name}" (${session.sessionId})`);
      await sleep(1300); // Add a delay to make it feel more natural
      setIsTyping(false);
      setTempDir(path.join(tmpdir(), 'agent-preview', `${timestamp}-${session.sessionId}`));
      setMessages([{ role: name, content: session.messages[0].message, timestamp: new Date() }]);
    };

    void startSession();
  }, []);

  React.useEffect(() => {
    saveTranscriptsToFile(tempDir, messages, responses);
  }, [tempDir, messages, responses]);

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        width={process.stdout.columns}
        borderStyle="round"
        alignItems="center"
        marginTop={1}
        marginBottom={1}
        paddingLeft={1}
        paddingRight={1}
      >
        <Text bold>{header}</Text>
      </Box>
      {messages.length > 0 && (
        <Box flexDirection="column">
          {messages.map(({ timestamp: ts, role, content }, idx) => (
            <Box
              key={role + '__' + ts.toISOString() + '__' + idx.toString()}
              alignItems={role === 'user' ? 'flex-end' : 'flex-start'}
              flexDirection="column"
            >
              <Box flexDirection="row" columnGap={1}>
                <Text>{role === 'user' ? 'You' : role}</Text>
                <Text color="grey">{ts.toLocaleString()}</Text>
              </Box>
              <Box
                // Use 70% of the terminal width, or the width of a single line of content, whichever is smaller
                width={Math.min(process.stdout.columns * 0.7, calculateWidth(content))}
                borderStyle="round"
                paddingLeft={1}
                paddingRight={1}
              >
                <Text>{content}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {isTyping ? (
        <Box flexDirection="column">
          <Box alignItems="flex-start" flexDirection="column">
            <Box flexDirection="row" columnGap={1}>
              <Text>{name}</Text>
              <Text color="grey">{new Date().toLocaleString()}</Text>
            </Box>
            <Box width={7} borderStyle="round" paddingLeft={1} paddingRight={1}>
              <Typing />
            </Box>
          </Box>
        </Box>
      ) : null}

      <Box paddingLeft={1} paddingRight={1}>
        {/* TODO: Resize this with the window */}
        <Text dimColor>{'─'.repeat(process.stdout.columns - 2)}</Text>
      </Box>

      <Box>
        <Text>{figures.pointer} </Text>
        <TextInput
          showCursor
          value={query}
          placeholder="Start typing…"
          onChange={setQuery}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onSubmit={async (content) => {
            if (!content) return;
            setQuery('');

            // Add the most recent user message to the chat window
            setMessages((prev) => [...prev, { role: 'user', content, timestamp: new Date() }]);
            setIsTyping(true);
            const response = await agent.send(sessionId, content);
            setResponses((prev) => [...prev, response]);
            const message = response.messages[0].message;

            if (!message) {
              throw new Error('Failed to send message');
            }
            setIsTyping(false);

            // Add the agent's response to the chat
            setMessages((prev) => [...prev, { role: name, content: message, timestamp: new Date() }]);
          }}
        />
      </Box>
    </Box>
  );
}
