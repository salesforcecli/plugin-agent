/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import React from 'react';
import { Box, Text } from 'ink';
import figures from '@inquirer/figures';
import TextInput from 'ink-text-input';
import { sleep } from '@salesforce/kit';

/**
 * Ideas:
 * - Limit height based on terminal height
 * - Add keystroke to clear chat
 * - Add keystroke to scroll up
 * - Add keystroke to scroll down
 */
export function AgentPreviewReact(): React.ReactNode {
  const [comments, setComments] = React.useState<Array<{ timestamp: Date; role: 'system' | 'user'; content: string }>>(
    []
  );
  const [query, setQuery] = React.useState('');
  return (
    <Box flexDirection="column">
      {comments.length > 0 && (
        <Box flexDirection="column">
          {comments.map(({ timestamp, role, content }, idx) => (
            <Box
              key={role + '__' + timestamp.toISOString() + '__' + idx.toString()}
              alignItems={role === 'user' ? 'flex-end' : 'flex-start'}
              flexDirection="column"
            >
              <Box flexDirection="row" columnGap={1}>
                <Text>{role === 'user' ? 'You' : role}</Text>
                <Text color="gray">{timestamp.toLocaleString()}</Text>
              </Box>
              <Box
                width={Math.min(process.stdout.columns - 4, content.length + 4)}
                borderStyle="round"
                paddingLeft={1}
                paddingRight={1}
              >
                <Text>{content}</Text>
              </Box>
            </Box>
          ))}
          <Box paddingLeft={1} paddingRight={1}>
            <Text dimColor>{'─'.repeat(process.stdout.columns - 2)}</Text>
          </Box>
        </Box>
      )}

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

            setComments((prev) => [...prev, { role: 'user', content, timestamp: new Date() }]);
            await sleep(1000);

            setComments((prev) => {
              const lastComment = prev[prev.length - 1];
              // TODO - use agents library for generations
              return (Math.random() * 2) % 2 > 1
                ? [
                    ...prev,
                    { role: 'system', content: "I'm sorry, I can't help with this request", timestamp: new Date() },
                  ]
                : [...prev, { ...lastComment, role: 'system', content: 'We have a scuba class at 9:30 AM' }];
            });
          }}
        />
      </Box>
    </Box>
  );
}
