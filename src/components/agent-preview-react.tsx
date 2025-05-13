/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';
import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Connection } from '@salesforce/core';
import { AgentPreview, AgentPreviewSendResponse, writeDebugLog } from '@salesforce/agents';
import { sleep } from '@salesforce/kit';

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

// Split the content on newlines, then find the longest array element
const calculateWidth = (content: string): number =>
  content.split('\n').reduce((acc, line) => Math.max(acc, line.length), 0) + 4;

const saveTranscriptsToFile = (
  outputDir: string,
  messages: Array<{ timestamp: Date; role: string; content: string }>,
  responses: AgentPreviewSendResponse[]
): void => {
  if (!outputDir) return;
  fs.mkdirSync(outputDir, { recursive: true });

  const transcriptPath = path.join(outputDir, 'transcript.json');
  fs.writeFileSync(transcriptPath, JSON.stringify(messages, null, 2));

  const responsesPath = path.join(outputDir, 'responses.json');
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
  readonly connection: Connection;
  readonly agent: AgentPreview;
  readonly name: string;
  readonly outputDir: string | undefined;
}): React.ReactNode {
  const [messages, setMessages] = React.useState<Array<{ timestamp: Date; role: string; content: string }>>([]);
  const [header, setHeader] = React.useState('Starting session...');
  const [sessionId, setSessionId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(true);
  const [sessionEnded, setSessionEnded] = React.useState(false);
  // @ts-expect-error: Complains if this is not defined but it's not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [timestamp, setTimestamp] = React.useState(new Date().getTime());
  const [tempDir, setTempDir] = React.useState('');
  const [responses, setResponses] = React.useState<AgentPreviewSendResponse[]>([]);

  const { connection, agent, name, outputDir } = props;

  useInput((input, key) => {
    if (key.escape) {
      setSessionEnded(true);
    }
    if (key.ctrl && input === 'c') {
      setSessionEnded(true);
    }
  });

  React.useEffect(() => {
    const endSession = async (): Promise<void> => {
      if (sessionEnded) {
        // TODO: Support other end types (such as Escalate)
        await agent.end(sessionId, 'UserRequest');
        process.exit(0);
      }
    };
    void endSession();
  }, [sessionEnded]);

  React.useEffect(() => {
    const startSession = async (): Promise<void> => {
      const session = await agent.start();
      setSessionId(session.sessionId);
      setHeader(`New session started with "${props.name}" (${session.sessionId})`);
      await sleep(500); // Add a short delay to make it feel more natural
      setIsTyping(false);
      if (outputDir) {
        const dateForDir = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        setTempDir(path.join(outputDir, `${dateForDir}--${session.sessionId}`));
      }
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

      <Box marginBottom={1}>
        <Text>&gt; </Text>
        <TextInput
          showCursor
          value={query}
          placeholder="Start typing (press ESC to exit)"
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

            // If there is an apex debug log entry, get the log and write it to the output dir
            if (response.apexDebugLog && tempDir) {
              // Write the apex debug  to the output dir
              await writeDebugLog(connection, response.apexDebugLog, tempDir);
            }
          }}
        />
      </Box>

      {sessionEnded ? (
        <Box
          flexDirection="column"
          width={process.stdout.columns}
          borderStyle="round"
          marginTop={1}
          marginBottom={1}
          paddingLeft={1}
          paddingRight={1}
        >
          <Text bold>Session Ended</Text>
          {outputDir ? <Text>Conversation log: {tempDir}/transcript.json</Text> : null}
          {outputDir ? <Text>API transactions: {tempDir}/responses.json</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
}
