// tests/unit/tui-components.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { UserMessage } from '@/tui/components/message-user.js';
import { AssistantMessage } from '@/tui/components/message-assistant.js';
import { ToolCard } from '@/tui/components/tool-card.js';

describe('Message Components', () => {
  describe('UserMessage', () => {
    it('should render user message', () => {
      const { lastFrame } = render(<UserMessage text="Hello world" />);
      expect(lastFrame()).toContain('Hello world');
      expect(lastFrame()).toContain('You');
    });
  });

  describe('AssistantMessage', () => {
    it('should render assistant message', () => {
      const { lastFrame } = render(<AssistantMessage text="Hi there!" />);
      expect(lastFrame()).toContain('Hi there!');
      expect(lastFrame()).toContain('Talon');
    });
  });
});

describe('ToolCard', () => {
  it('should render tool call', () => {
    const { lastFrame } = render(
      <ToolCard 
        toolName="file_read"
        args={{ path: "config.json" }}
        status="pending"
      />
    );
    expect(lastFrame()).toContain('file_read');
    expect(lastFrame()).toContain('config.json');
  });

  it('should show success result', () => {
    const { lastFrame } = render(
      <ToolCard 
        toolName="file_read"
        args={{ path: "config.json" }}
        status="success"
        result="{ content: 'test' }"
        duration={120}
      />
    );
    expect(lastFrame()).toContain('✅');
    expect(lastFrame()).toContain('120ms');
  });
});
