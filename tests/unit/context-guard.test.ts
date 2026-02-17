// ─── Context Guard Tests ──────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateMessagesTokens, resolveContextWindow } from '@/agent/context-guard.js';

describe('Context Guard', () => {
    describe('estimateTokens', () => {
        it('should estimate tokens for simple text', () => {
            const text = 'Hello world';
            const tokens = estimateTokens(text);
            
            // ~4 chars per token
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThan(10);
        });

        it('should estimate more tokens for longer text', () => {
            const shortText = 'Hello';
            const longText = 'Hello world this is a much longer text with many more words';
            
            const shortTokens = estimateTokens(shortText);
            const longTokens = estimateTokens(longText);
            
            expect(longTokens).toBeGreaterThan(shortTokens);
        });

        it('should handle empty string', () => {
            const tokens = estimateTokens('');
            expect(tokens).toBe(0);
        });
    });

    describe('estimateMessagesTokens', () => {
        it('should estimate tokens for message array', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' },
            ];
            
            const tokens = estimateMessagesTokens(messages);
            expect(tokens).toBeGreaterThan(0);
        });

        it('should handle empty messages', () => {
            const tokens = estimateMessagesTokens([]);
            expect(tokens).toBe(0);
        });
    });

    describe('resolveContextWindow', () => {
        it('should resolve GPT-4o context window', () => {
            const window = resolveContextWindow('gpt-4o');
            expect(window).toBe(128_000);
        });

        it('should resolve DeepSeek context window', () => {
            const window = resolveContextWindow('deepseek-chat');
            expect(window).toBe(64_000);
        });

        it('should return default for unknown model', () => {
            const window = resolveContextWindow('unknown-model');
            expect(window).toBe(128_000);
        });

        it('should handle case-insensitive matching', () => {
            const window = resolveContextWindow('GPT-4O');
            expect(window).toBe(128_000);
        });
    });
});
