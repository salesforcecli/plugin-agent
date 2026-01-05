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

import path from 'node:path';
import fs from 'node:fs';
import * as process from 'node:process';
import { resolve } from 'node:path';
import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Connection, SfError, Lifecycle, Logger } from '@salesforce/core';
import { AgentPreviewBase, AgentPreviewSendResponse, writeDebugLog } from '@salesforce/agents';
import { sleep, env } from '@salesforce/kit';
import { PlannerResponse } from '@salesforce/agents/lib/types.js';

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

export const saveTranscriptsToFile = (
  outputDir: string,
  messages: Array<{ timestamp: Date; role: string; content: string }>,
  responses: AgentPreviewSendResponse[],
  traces?: PlannerResponse[]
): void => {
  if (!outputDir) return;
  fs.mkdirSync(outputDir, { recursive: true });

  const transcriptPath = path.join(outputDir, 'transcript.json');
  fs.writeFileSync(transcriptPath, JSON.stringify(messages, null, 2));

  const responsesPath = path.join(outputDir, 'responses.json');
  fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));

  if (traces) {
    const tracesPath = path.join(outputDir, 'traces.json');
    fs.writeFileSync(tracesPath, JSON.stringify(traces, null, 2));
  }
};

export const getTraces = async (
  agent: AgentPreviewBase,
  sessionId: string,
  messageIds: string[],
  logger: Logger
): Promise<PlannerResponse[]> => {
  if (messageIds.length > 0) {
    try {
      const traces = await agent.traces(sessionId, messageIds);
      return traces;
    } catch (e) {
      const sfError = SfError.wrap(e);
      logger.info(`Error obtaining traces: ${sfError.name} - ${sfError.message}`, { sessionId, messageIds });
    }
  }
  return [];
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
  readonly agent: AgentPreviewBase;
  readonly name: string;
  readonly outputDir: string | undefined;
  readonly isLocalAgent: boolean;
  readonly apexDebug: boolean | undefined;
  readonly logger: Logger;
}): React.ReactNode {
  const [messages, setMessages] = React.useState<Array<{ timestamp: Date; role: string; content: string }>>([]);
  const [header, setHeader] = React.useState('Starting session...');
  const [sessionId, setSessionId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(true);
  const [sessionEnded, setSessionEnded] = React.useState(false);
  const [exitRequested, setExitRequested] = React.useState(false);
  const [showSavePrompt, setShowSavePrompt] = React.useState(false);
  const [showDirInput, setShowDirInput] = React.useState(false);
  const [saveDir, setSaveDir] = React.useState('');
  const [saveConfirmed, setSaveConfirmed] = React.useState(false);
  // @ts-expect-error: Complains if this is not defined but it's not used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [timestamp, setTimestamp] = React.useState(new Date().getTime());
  const [tempDir, setTempDir] = React.useState('');
  const [responses, setResponses] = React.useState<AgentPreviewSendResponse[]>([]);
  const [apexDebugLogs, setApexDebugLogs] = React.useState<string[]>([]);
  const [messageIds, setMessageIds] = React.useState<string[]>([]);

  const { connection, agent, name, outputDir, isLocalAgent, apexDebug, logger } = props;

  useInput((input, key) => {
    // If user is in directory input and presses ESC, cancel and exit without saving
    if (showDirInput && (key.escape || (key.ctrl && input === 'c'))) {
      setSessionEnded(true);
      return;
    }

    // Only handle exit if we're not already in save prompt flow
    if (!exitRequested && !showSavePrompt && !showDirInput) {
      if (key.escape || (key.ctrl && input === 'c')) {
        setExitRequested(true);
        setShowSavePrompt(true);
      }
      return;
    }

    // Handle save prompt navigation
    if (showSavePrompt && !showDirInput) {
      if (input.toLowerCase() === 'y' || input.toLowerCase() === 'n') {
        if (input.toLowerCase() === 'y') {
          // If outputDir was provided via flag, use it directly
          if (outputDir) {
            setSaveDir(outputDir);
            setSaveConfirmed(true);
            setShowSavePrompt(false);
          } else {
            // Otherwise, prompt for directory
            setShowSavePrompt(false);
            setShowDirInput(true);
            const defaultDir = env.getString('SF_AGENT_PREVIEW_OUTPUT_DIR', path.join('temp', 'agent-preview'));
            setSaveDir(defaultDir);
          }
        } else {
          // User said no, exit without saving
          setSessionEnded(true);
        }
      }
    }
  });

  React.useEffect(() => {
    const endSession = async (): Promise<void> => {
      if (sessionEnded) {
        try {
          // TODO: Support other end types (such as Escalate)
          await agent.end(sessionId, 'UserRequest');
          process.exit(0);
        } catch (e) {
          // in case the agent session never started, calling agent.end will throw an error, but we've already shown the error to the user
          process.exit(0);
        }
      }
    };
    void endSession();
  }, [sessionEnded, sessionId, agent]);

  React.useEffect(() => {
    // Set up event listeners for agent compilation and simulation events
    const lifecycle = Lifecycle.getInstance();

    const handleCompilingEvent = (): Promise<void> => {
      setHeader('Compiling agent...');
      return Promise.resolve();
    };

    const handleSimulationStartingEvent = (): Promise<void> => {
      setHeader('Starting session...');
      return Promise.resolve();
    };

    const handleSessionStartedEvent = (): Promise<void> => {
      setHeader(`New session started with "${props.name}"`);
      return Promise.resolve();
    };

    // Listen for the events
    lifecycle.on('agents:compiling', handleCompilingEvent);
    lifecycle.on('agents:simulation-starting', handleSimulationStartingEvent);
    lifecycle.on('agents:session-started', handleSessionStartedEvent);

    const startSession = async (): Promise<void> => {
      try {
        const session = await agent.start();
        setSessionId(session.sessionId);
        setHeader(`New session started with "${props.name}" (${session.sessionId})`);

        await sleep(500); // Add a short delay to make it feel more natural
        setIsTyping(false);
        // Add the initial agent message if present
        if (session.messages.at(0)?.message) {
          setMessages([{ role: name, content: session.messages[0].message, timestamp: new Date() }]);
        }
      } catch (e) {
        const sfError = SfError.wrap(e);
        setIsTyping(false);
        setHeader('Error starting session');
        setMessages([{ role: name, content: `${sfError.name} - ${sfError.message}`, timestamp: new Date() }]);
        setSessionEnded(true);
      }
    };

    void startSession();
  }, [agent, name, outputDir, props.name, isLocalAgent]);

  React.useEffect(() => {
    // Save to tempDir if it was set (during session)
    if (tempDir) {
      saveTranscriptsToFile(tempDir, messages, responses);
    }
  }, [tempDir, messages, responses]);

  // Handle saving when user confirms save on exit
  React.useEffect(() => {
    const saveAndExit = async (): Promise<void> => {
      if (saveConfirmed && saveDir) {
        const finalDir = resolve(saveDir);
        fs.mkdirSync(finalDir, { recursive: true });

        // Create a timestamped subdirectory for this session
        const dateForDir = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const sessionDir = path.join(finalDir, `${dateForDir}--${sessionId || 'session'}`);
        fs.mkdirSync(sessionDir, { recursive: true });

        const traces = await getTraces(agent, sessionId, messageIds, logger);

        saveTranscriptsToFile(sessionDir, messages, responses, traces);

        // Write apex debug logs if any
        if (apexDebug) {
          for (const response of responses) {
            if (response.apexDebugLog) {
              // eslint-disable-next-line no-await-in-loop
              await writeDebugLog(connection, response.apexDebugLog, sessionDir);
              const logId = response.apexDebugLog.Id;
              if (logId) {
                setApexDebugLogs((prev) => [...prev, path.join(sessionDir, `${logId}.log`)]);
              }
            }
          }
        }

        // Update tempDir so the save message shows the correct path
        setTempDir(sessionDir);

        // Mark session as ended to trigger exit
        setSessionEnded(true);
      }
    };
    void saveAndExit();
  }, [saveConfirmed, saveDir, messages, responses, sessionId, apexDebug, connection, agent, messageIds, logger]);

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
              {role === 'system' ? (
                <Box
                  width={process.stdout.columns}
                  borderStyle="round"
                  borderColor="yellow"
                  paddingLeft={1}
                  paddingRight={1}
                  marginBottom={1}
                >
                  <Text>{content}</Text>
                </Box>
              ) : (
                <>
                  <Box flexDirection="row" columnGap={1}>
                    <Text>{role === 'user' ? 'You' : role}</Text>
                    <Text color="grey">{ts.toLocaleString()}</Text>
                  </Box>
                  <Box borderStyle="round" paddingLeft={1} paddingRight={1}>
                    <Text>{content}</Text>
                  </Box>
                </>
              )}
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

      {showSavePrompt && !showDirInput ? (
        <Box
          flexDirection="column"
          width={process.stdout.columns}
          borderStyle="round"
          borderColor="yellow"
          marginTop={1}
          marginBottom={1}
          paddingLeft={1}
          paddingRight={1}
        >
          <Text bold>Save chat history before exiting? (y/n)</Text>
          {outputDir ? (
            <Text dimColor>Will save to: {outputDir}</Text>
          ) : (
            <Text dimColor>Press &#39;y&#39; to save, &#39;n&#39; to exit without saving</Text>
          )}
        </Box>
      ) : null}

      {showDirInput ? (
        <Box
          flexDirection="column"
          width={process.stdout.columns}
          borderStyle="round"
          borderColor="yellow"
          marginTop={1}
          marginBottom={1}
          paddingLeft={1}
          paddingRight={1}
        >
          <Text bold>Enter output directory for {apexDebug ? 'debug logs and transcripts' : 'transcripts'}:</Text>
          <Box marginTop={1}>
            <Text>&gt; </Text>
            <TextInput
              showCursor
              value={saveDir}
              placeholder="Press Enter to confirm"
              onChange={setSaveDir}
              onSubmit={(dir) => {
                if (dir) {
                  setSaveDir(dir);
                  setSaveConfirmed(true);
                  setShowDirInput(false);
                }
              }}
            />
          </Box>
        </Box>
      ) : null}

      {!sessionEnded && !exitRequested && !showSavePrompt && !showDirInput ? (
        <Box marginBottom={1}>
          <Text>&gt; </Text>
          <TextInput
            showCursor
            value={query}
            placeholder="Start typing (press ESC or Ctrl+C to exit)"
            onChange={setQuery}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSubmit={async (content) => {
              if (!content) return;
              setQuery('');

              try {
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
                setMessageIds((prev) => [...prev, response.messages[0].planId]);

                // Apex debug logs will be saved when user exits and chooses to save
              } catch (e) {
                const sfError = SfError.wrap(e);
                setIsTyping(false);
                setHeader(`Error: ${sfError.name}`);
                setMessages([{ role: name, content: `${sfError.name} - ${sfError.message}`, timestamp: new Date() }]);
                setSessionEnded(true);
              }
            }}
          />
        </Box>
      ) : null}

      {sessionEnded && !showSavePrompt && !showDirInput ? (
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
          {tempDir ? <Text>Conversation log: {tempDir}/transcript.json</Text> : null}
          {tempDir ? <Text>API transactions: {tempDir}/responses.json</Text> : null}
          {tempDir ? <Text>Traces: {tempDir}/traces.json</Text> : null}
          {apexDebugLogs.length > 0 && tempDir && <Text>Apex Debug Logs saved to: {tempDir}</Text>}
        </Box>
      ) : null}
    </Box>
  );
}
