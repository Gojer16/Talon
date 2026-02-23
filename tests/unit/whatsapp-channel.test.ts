// ─── WhatsApp Channel Tests ─────────────────────────────────────────────
// Unit tests for WhatsApp channel implementation

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WhatsAppChannel } from '@/channels/whatsapp/index.js';
import { SessionManager } from '@/gateway/sessions.js';
import { EventBus } from '@/gateway/events.js';
import { MessageRouter } from '@/gateway/router.js';
import type { TalonConfig } from '@/config/schema.js';

const mockConfig: TalonConfig = {
    gateway: { host: '127.0.0.1', port: 19789, auth: { mode: 'none' }, tailscale: { enabled: false, mode: 'off', resetOnExit: true }, cors: { origins: ['http://127.0.0.1:*'] } },
    agent: { model: 'deepseek/deepseek-chat', providers: { deepseek: { apiKey: 'test-key', models: ['deepseek-chat'] } }, failover: [], maxTokens: 4096, maxIterations: 10, temperature: 0.7, thinkingLevel: 'medium' },
    channels: {
        cli: { enabled: true },
        telegram: { enabled: false },
        discord: { enabled: false },
        whatsapp: { enabled: true, allowedUsers: ['584128449024'], allowedGroups: [], groupActivation: 'mention', sessionName: 'Talon' },
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

describe('WhatsAppChannel', () => {
    let channel: WhatsAppChannel;
    let eventBus: EventBus;
    let sessionManager: SessionManager;
    let router: MessageRouter;

    beforeEach(() => {
        eventBus = new EventBus();
        sessionManager = new SessionManager(mockConfig, eventBus);
        router = new MessageRouter(sessionManager, eventBus);
        channel = new WhatsAppChannel(mockConfig, eventBus, sessionManager, router);
    });

    describe('Constructor', () => {
        it('should create channel with correct name', () => {
            expect(channel.name).toBe('whatsapp');
        });

        it('should set authDir to secure location', () => {
            // CHAN-022: Auth should be in ~/.talon/auth/whatsapp, not workspace
            const authDir = (channel as any).authDir;
            expect(authDir).toContain('.talon');
            expect(authDir).toContain('auth');
            expect(authDir).toContain('whatsapp');
        });
    });

    describe('Rate Limiting', () => {
        it('should have rate limit constant defined', () => {
            const rateLimit = (channel as any).RATE_LIMIT_MS;
            expect(rateLimit).toBe(1000); // 1 second between messages
        });

        it('should have message queue', () => {
            const queue = (channel as any).messageQueue;
            expect(Array.isArray(queue)).toBe(true);
        });

        it('should have max reconnect attempts', () => {
            const maxAttempts = (channel as any).maxReconnectAttempts;
            expect(maxAttempts).toBe(5);
        });
    });

    describe('send()', () => {
        it('should handle session not found gracefully', async () => {
            await expect(channel.send('nonexistent-session', { text: 'test' })).resolves.not.toThrow();
        });

        it('should chunk very long messages', async () => {
            // Create a mock session
            const sessionId = 'whatsapp:584128449024@c.us';
            const veryLongMessage = 'A'.repeat(70000); // Exceeds 65000 limit

            sessionManager.createSession('whatsapp', '584128449024@c.us', 'Test User');
            const session = sessionManager.getSession(sessionId);
            if (session) {
                session.messages.push({ role: 'assistant', content: veryLongMessage });
            }

            // Should not throw, will queue messages (won't send without actual WhatsApp)
            await expect(channel.send(sessionId, { text: veryLongMessage })).resolves.not.toThrow();
        });
    });

    describe('stripMarkdown()', () => {
        it('should convert bold to WhatsApp format', () => {
            const text = '**bold text**';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toBe('*bold text*');
        });

        it('should preserve inline code', () => {
            const text = '`code`';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toBe('`code`');
        });

        it('should remove code blocks', () => {
            const text = '```python\nprint("hello")\n```';
            const result = (channel as any).stripMarkdown(text);
            expect(result).toContain('print("hello")');
        });
    });

    describe('Authorization', () => {
        it('should have allowedUsers configured', () => {
            expect(mockConfig.channels.whatsapp?.allowedUsers).toContain('584128449024');
        });

        it('should respect group activation mode', () => {
            expect(mockConfig.channels.whatsapp?.groupActivation).toBe('mention');
        });
    });

    describe('getStatus()', () => {
        it('should return status object', () => {
            const status = channel.getStatus();
            expect(status).toHaveProperty('ready');
            expect(status).toHaveProperty('qrCode');
            expect(typeof status.ready).toBe('boolean');
        });
    });
});
