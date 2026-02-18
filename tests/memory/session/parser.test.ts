import { describe, it, expect } from 'vitest';
import { parseSessionFile, messagesToText } from '../../../src/memory/session/parser.js';

describe('Session Parser', () => {
  it('should parse JSONL session file', () => {
    const content = `{"role":"user","content":"Hello"}
{"role":"assistant","content":"Hi there!"}`;

    const messages = parseSessionFile(content);

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
  });

  it('should skip invalid lines', () => {
    const content = `{"role":"user","content":"Valid"}
invalid json
{"role":"assistant","content":"Also valid"}`;

    const messages = parseSessionFile(content);

    expect(messages.length).toBe(2);
  });

  it('should convert messages to text', () => {
    const messages = [
      { role: 'user' as const, content: 'Question' },
      { role: 'assistant' as const, content: 'Answer' },
    ];

    const text = messagesToText(messages);

    expect(text).toContain('User: Question');
    expect(text).toContain('Assistant: Answer');
  });
});
