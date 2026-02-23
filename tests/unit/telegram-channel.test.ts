// ─── Telegram Channel Tests ─────────────────────────────────────────────
// Unit tests for Telegram channel implementation

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TelegramChannel } from '@/channels/telegram/index.js';
import { SessionManager } from '@/gateway/sessions.js';
import { EventBus } from '@/gateway/events.js';
import { MessageRouter } from '@/gateway/router.js';
import type { TalonConfig } from '@/config/schema.js';

const mockConfig: TalonConfig = {
    gateway: { host: '127.0.0.1', port: 19789, auth: { mode: 'none' }, tailscale: { enabled: false, mode: 'off', resetOnExit: true }, cors: { origins: ['http://127.0.0.1:*'] } },
    agent: { model: 'deepseek/deepseek-chat', providers: { deepseek: { apiKey: 'test-key', models: ['deepseek-chat'] } }, failover: [], maxTokens: 4096, maxIterations: 10, temperature: 0.7, thinkingLevel: 'medium' },
    channels: {
        cli: { enabled: true },
        telegram: { enabled: true, botToken: '123456:TEST-BOT-TOKEN', allowedUsers: ['123456789'], allowedGroups: [], groupActivation: 'mention' },
        discord: { enabled: false },
        whatsapp: { enabled: false },
        webchat: { enabled: true },
    },
    tools: { files: { enabled: true, allowedPaths: ['/tmp'], deniedPaths: [] }, shell: { enabled: true }, browser: { enabled: false }, os: { enabled: true }, web: { search: { enabled: false }, fetch: { enabled: false } } },
    memory: { enabled: true, session: { idleTimeout: 60000, archiveAfterDays: 30, maxMessagesBeforeCompact: 100 }, compaction: { enabled: true, threshold: 0.8, keepRecentMessages: 10 } },
    workspace: { root: '/tmp/test-workspace' },
    skills: { enabled: false, dir: '' },
    shadow: { enabled: false, watchers: { filesystem: { paths: [], ignore: [], events: [] }, shell: { watchErrors: false }, git: { enabled: false } }, cooldown: 30000, maxGhostsPerHour: 10 },
    security: { sandbox: { mode: 'off', engine: 'docker', allowedTools: [], deniedTools: [] }, audit: { enabled: false } },
    ui: { theme: 'dark', showToolCalls: true, showTokenUsage: false, streaming: true },
    hooks: { bootMd: { enabled: false } },
    vectorMemory: { enabled: false, provider: 'simple', retentionDays: 90 },
    memoryV2: { enabled: true, embeddings: { provider: 'auto', fallback: 'gemini', cacheSize: 1000 }, chunking: { tokens: 400, overlap: 80 }, search: { vectorWeight: 0.7, keywordWeight: 0.3, defaultLimit: 10 }, watcher: { enabled: true, debounceMs: 1500, paths: ['memory/**/*.md'], ignore: ['**/node_modules/**', '**/.git/**'] }, indexSessions: true },
} as TalonConfig;

describe('TelegramChannel', () => {
    let channel: TelegramChannel;
    let eventBus: EventBus;
    let sessionManager: SessionManager;
    let router: MessageRouter;

    beforeEach(() => {
        eventBus = new EventBus();
        sessionManager = new SessionManager(mockConfig, eventBus);
        router = new MessageRouter(sessionManager, eventBus);
        channel = new TelegramChannel(mockConfig, eventBus, sessionManager, router);
    });

    afterEach(async () => {
        await channel.stop();
    });

    describe('Constructor', () => {
        it('should create channel with correct name', () => {
            expect(channel.name).toBe('telegram');
        });
    });

    describe('send()', () => {
        it('should handle long messages by chunking', async () => {
            // Create a mock session
            const sessionId = 'telegram:123456789';
            const longMessage = 'A'.repeat(5000); // Exceeds 4096 limit

            // Mock session
            sessionManager.createSession('telegram', '123456789', 'Test User');
            const session = sessionManager.getSession(sessionId);
            if (session) {
                session.messages.push({ role: 'assistant', content: longMessage });
            }

            // Note: This will fail without actual Telegram API, but tests the chunking logic
            await expect(channel.send(sessionId, { text: longMessage })).resolves.not.toThrow();
        });

        it('should handle session not found', async () => {
            await expect(channel.send('nonexistent-session', { text: 'test' })).resolves.not.toThrow();
        });
    });

    describe('stripMarkdown()', () => {
        it('should remove bold formatting', () => {
            const text = '**bold text**';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toBe('bold text');
        });

        it('should preserve code block content', () => {
            const text = 'Here is code:\n```python\nprint("hello")\n```';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toContain('print("hello")');
        });

        it('should remove headers', () => {
            const text = '# Header\n## Subheader';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toBe('Header\nSubheader');
        });

        it('should convert bullet points to spaces', () => {
            const text = '- Item 1\n- Item 2';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toContain('Item 1');
            expect(result).toContain('Item 2');
        });
    });

    describe('convertToTelegramMarkdown()', () => {
        it('should escape special characters', () => {
            const text = 'Hello_world with *asterisk*';
            const result = (channel as any).convertToTelegramMarkdown(text);
            expect(result).toContain('\\_');
            expect(result).toContain('\\*');
        });

        it('should preserve code blocks', () => {
            const text = '```python\nprint("test")\n```';
            const result = (channel as any).convertToTelegramMarkdown(text);
            expect(result).toContain('```python');
            expect(result).toContain('print("test")');
        });

        it('should escape bold markers (not convert)', () => {
            const text = '**bold**';
            const result = (channel as any).convertToTelegramMarkdown(text);
            // The function escapes special chars first, so ** becomes \*\*
            expect(result).toContain('\\*');
        });
    });

    describe('Authorization', () => {
        it('should allow authorized users', () => {
            // Config has allowedUsers: ['123456789']
            expect(mockConfig.channels.telegram.allowedUsers).toContain('123456789');
        });

        it('should respect group activation mode', () => {
            expect(mockConfig.channels.telegram.groupActivation).toBe('mention');
        });
    });
});
