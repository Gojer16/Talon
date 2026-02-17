// ─── Model Router Tests ──────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelRouter, type TaskComplexity } from '@/agent/router.js';
import type { TalonConfig } from '@/config/schema.js';
import type { OpenAICompatibleProvider } from '@/agent/providers/openai-compatible.js';

const mockProvider = {
    chat: vi.fn(),
} as unknown as OpenAICompatibleProvider;

const mockConfig: TalonConfig = {
    gateway: {
        host: '127.0.0.1',
        port: 19789,
        auth: { mode: 'none' },
        tailscale: { enabled: false, mode: 'off', resetOnExit: true },
        cors: { origins: ['http://127.0.0.1:*'] },
    },
    agent: {
        model: 'deepseek/deepseek-chat',
        providers: {
            deepseek: {
                apiKey: 'test-key',
                models: ['deepseek-chat', 'deepseek-reasoner'],
            },
            openai: {
                apiKey: 'test-key',
                models: ['gpt-4o', 'gpt-4o-mini'],
            },
            openrouter: {
                apiKey: 'test-key',
                models: ['openrouter-model'],
            },
        },
        failover: [],
        maxTokens: 4096,
        maxIterations: 10,
        temperature: 0.7,
        thinkingLevel: 'medium',
    },
    channels: {
        cli: { enabled: true },
        telegram: { enabled: false },
        discord: { enabled: false },
        whatsapp: { enabled: false },
        webchat: { enabled: true },
    },
    tools: {
        files: { enabled: true, allowedPaths: ['~/'], deniedPaths: ['~/.ssh', '~/.gnupg'] },
        shell: { enabled: true },
        browser: { enabled: false },
        os: { enabled: true },
        web: { search: { enabled: true }, fetch: { enabled: true } },
    },
    memory: {
        enabled: true,
        session: { idleTimeout: 1_800_000, archiveAfterDays: 30, maxMessagesBeforeCompact: 100 },
        compaction: { enabled: true, threshold: 0.8, keepRecentMessages: 10 },
    },
    workspace: { root: '~/.talon/workspace' },
    skills: { enabled: true, dir: '~/.talon/skills' },
    logging: { level: 'info' },
};

describe('ModelRouter', () => {
    describe('getProviderForTask', () => {
        it('should return null when no providers are configured', () => {
            const emptyConfig: TalonConfig = {
                ...mockConfig,
                agent: {
                    ...mockConfig.agent,
                    providers: {},
                },
            };
            
            const router = new ModelRouter(emptyConfig);
            const result = router.getProviderForTask('simple');
            expect(result).toBeNull();
        });

        it('should select deepseek for simple tasks (cheapest)', () => {
            const router = new ModelRouter(mockConfig);
            const result = router.getProviderForTask('simple');
            
            expect(result).not.toBeNull();
            expect(result?.providerId).toBe('deepseek');
        });

        it('should select deepseek for summarize tasks (cheapest)', () => {
            const router = new ModelRouter(mockConfig);
            const result = router.getProviderForTask('summarize');
            
            expect(result).not.toBeNull();
            expect(result?.providerId).toBe('deepseek');
        });

        it('should use default model for moderate tasks', () => {
            const router = new ModelRouter(mockConfig);
            const result = router.getProviderForTask('moderate');
            
            expect(result).not.toBeNull();
            expect(result?.model).toBe('deepseek-chat');
        });

        it('should select best provider for complex tasks', () => {
            const router = new ModelRouter(mockConfig);
            const result = router.getProviderForTask('complex');
            
            expect(result).not.toBeNull();
            // OpenAI should be selected for complex tasks (best quality)
            expect(['openai', 'deepseek']).toContain(result?.providerId);
        });
    });

    describe('hasProviders', () => {
        it('should return false when no providers with API keys', () => {
            const noKeyConfig: TalonConfig = {
                ...mockConfig,
                agent: {
                    ...mockConfig.agent,
                    providers: {
                        deepseek: {
                            apiKey: '', // No API key
                            models: ['deepseek-chat'],
                        },
                    },
                },
            };
            
            const router = new ModelRouter(noKeyConfig);
            expect(router.hasProviders()).toBe(false);
        });

        it('should return true when providers have API keys', () => {
            const router = new ModelRouter(mockConfig);
            expect(router.hasProviders()).toBe(true);
        });
    });

    describe('getAllProviders', () => {
        it('should return all configured providers', () => {
            const router = new ModelRouter(mockConfig);
            const providers = router.getAllProviders();
            
            expect(providers.length).toBeGreaterThan(0);
            expect(providers.some(p => p.id === 'deepseek')).toBe(true);
        });
    });

    describe('getDefaultProvider', () => {
        it('should return default provider for agent loop', () => {
            const router = new ModelRouter(mockConfig);
            const result = router.getDefaultProvider();
            
            expect(result).not.toBeNull();
            expect(result?.providerId).toBe('deepseek');
        });
    });
});
