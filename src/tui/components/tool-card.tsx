// src/tui/components/tool-card.tsx
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface ToolCardProps {
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
  result?: string;
  error?: string;
  duration?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function ToolCard({
  toolName,
  args,
  status,
  result,
  error,
  duration,
  isExpanded = false,
}: ToolCardProps) {
  const statusIcon = {
    pending: <Spinner type="dots" />,
    success: '✅',
    error: '❌',
  }[status];

  const borderColor = {
    pending: 'yellow',
    success: 'green',
    error: 'red',
  }[status];

  const argsStr = Object.entries(args)
    .map(([key, value]) => {
      const valStr = typeof value === 'string' 
        ? `"${value}"` 
        : JSON.stringify(value);
      return `${key}=${valStr}`;
    })
    .join(', ');

  const displayResult = result && !isExpanded && result.length > 100
    ? result.slice(0, 100) + '...'
    : result;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={borderColor}
      paddingX={1}
      marginY={1}
    >
      <Box>
        <Text>{statusIcon} </Text>
        <Text color="yellow" bold>{toolName}</Text>
        <Text dimColor>({argsStr})</Text>
      </Box>

      {duration !== undefined && status !== 'pending' && (
        <Box marginTop={1}>
          <Text dimColor>⏱️  {duration}ms</Text>
        </Box>
      )}

      {result && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">Result:</Text>
          <Box paddingLeft={2} marginTop={1}>
            <Text dimColor>{displayResult}</Text>
          </Box>
        </Box>
      )}

      {error && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Error:</Text>
          <Box paddingLeft={2} marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
