/**
 * Parse JSONL session file into messages.
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export function parseSessionFile(content: string): SessionMessage[] {
  const lines = content.split('\n').filter((line) => line.trim());
  const messages: SessionMessage[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.role && parsed.content) {
        messages.push({
          role: parsed.role,
          content: parsed.content,
          timestamp: parsed.timestamp,
        });
      }
    } catch (error) {
      // Skip invalid lines
      continue;
    }
  }

  return messages;
}

/**
 * Convert messages to searchable text.
 */
export function messagesToText(messages: SessionMessage[]): string {
  return messages
    .map((msg) => {
      const prefix = msg.role === 'user' ? 'User: ' : 'Assistant: ';
      return prefix + msg.content;
    })
    .join('\n\n');
}
