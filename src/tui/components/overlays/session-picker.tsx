// src/tui/components/overlays/session-picker.tsx
import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { fuzzySearch } from '../../utils/fuzzy.js';
import chalk from 'chalk';

export interface Session {
  id: string;
  key: string;
  lastMessage?: string;
  timestamp: Date;
  messageCount: number;
  tokenCount: number;
}

export interface SessionPickerProps {
  sessions: Session[];
  currentSessionId?: string;
  onSelect: (session: Session) => void;
  onCancel: () => void;
  onNewSession: () => void;
}

export function SessionPicker({
  sessions,
  currentSessionId,
  onSelect,
  onCancel,
  onNewSession,
}: SessionPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) {
      return sessions;
    }

    const results = fuzzySearch(sessions, searchQuery, {
      keys: ['key', 'lastMessage'],
      limit: 20,
    });

    return results.map(r => r.item);
  }, [sessions, searchQuery]);

  const items = [
    {
      label: chalk.green('+ New Session'),
      value: '__new__',
    },
    ...filteredSessions.map(session => ({
      label: formatSessionLabel(session, currentSessionId === session.id),
      value: session.id,
    })),
  ];

  return (
    <Box 
      flexDirection="column" 
      borderStyle="double" 
      borderColor="cyan"
      padding={2}
      width={80}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">💬 Select Session</Text>
        <Text dimColor> (Esc to cancel)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Search: </Text>
        <TextInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Type to filter..."
        />
      </Box>

      <Box flexDirection="column" height={15}>
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === '__new__') {
              onNewSession();
            } else {
              const session = sessions.find(s => s.id === item.value);
              if (session) onSelect(session);
            }
          }}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {filteredSessions.length} of {sessions.length} sessions
        </Text>
      </Box>
    </Box>
  );
}

function formatSessionLabel(session: Session, isCurrent: boolean): string {
  const prefix = isCurrent ? '● ' : '○ ';
  const key = chalk.cyan(session.key.slice(0, 20));
  const preview = session.lastMessage 
    ? chalk.dim(` • ${session.lastMessage.slice(0, 30)}...`)
    : '';
  const time = chalk.dim(` • ${formatRelativeTime(session.timestamp)}`);
  const stats = chalk.dim(` • ${session.messageCount} msgs, ${(session.tokenCount / 1000).toFixed(1)}k tokens`);

  return `${prefix}${key}${preview}${time}${stats}`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
