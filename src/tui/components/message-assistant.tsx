// src/tui/components/message-assistant.tsx
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface AssistantMessageProps {
  text: string;
  isStreaming?: boolean;
  timestamp?: Date;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  model?: string;
}

export function AssistantMessage({ 
  text, 
  isStreaming = false,
  timestamp,
  tokens,
  model,
}: AssistantMessageProps) {
  const timeStr = timestamp 
    ? timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="gray"
      paddingX={1}
      marginY={1}
    >
      <Box>
        <Text color="green">🦅 Talon</Text>
        {isStreaming && (
          <>
            <Text dimColor> • </Text>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
          </>
        )}
        {timeStr && !isStreaming && (
          <>
            <Text dimColor> • </Text>
            <Text dimColor>{timeStr}</Text>
          </>
        )}
        {model && (
          <>
            <Text dimColor> • </Text>
            <Text dimColor>{model}</Text>
          </>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text>{text}</Text>
      </Box>

      {tokens && !isStreaming && (
        <Box marginTop={1}>
          <Text dimColor>
            💰 {tokens.input} → {tokens.output} = {tokens.total} tokens
          </Text>
        </Box>
      )}
    </Box>
  );
}
