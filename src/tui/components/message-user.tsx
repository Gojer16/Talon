// src/tui/components/message-user.tsx
import React from 'react';
import { Box, Text } from 'ink';

export interface UserMessageProps {
  text: string;
  timestamp?: Date;
}

export function UserMessage({ text, timestamp }: UserMessageProps) {
  const timeStr = timestamp 
    ? timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="yellow"
      paddingX={1}
      marginY={1}
    >
      <Box>
        <Text color="cyan" bold>You</Text>
        {timeStr && (
          <>
            <Text dimColor> • </Text>
            <Text dimColor>{timeStr}</Text>
          </>
        )}
      </Box>
      <Box marginTop={1}>
        <Text>{text}</Text>
      </Box>
    </Box>
  );
}
