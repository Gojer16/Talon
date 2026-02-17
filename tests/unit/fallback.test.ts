// ─── Model Fallback Tests ────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackRouter, classifyError, type FallbackError } from '@/agent/fallback.js';
import type { OpenAICompatibleProvider, LLMResponse, LLMMessage } from '@/agent/providers/openai-compatible.js';

describe('Fallback System', () => {
    describe('classifyError', () => {
        it('should classify auth errors as non-retryable', () => {
            const errors = [
                new Error('401 Unauthorized'),
                new Error('Invalid API key'),
                new Error('Authentication failed'),
            ];
            
            errors.forEach(error => {
                const result = classifyError(error, 'deepseek');
                expect(result.type).toBe('auth');
                expect(result.retryable).toBe(false);
            });
        });

        it('should classify rate limit errors as retryable', () => {
            const errors = [
                new Error('429 Too Many Requests'),
                new Error('Rate limit exceeded'),
            ];
            
            errors.forEach(error => {
                const result = classifyError(error, 'deepseek');
                expect(result.type).toBe('rate-limit');
                expect(result.retryable).toBe(true);
            });
        });

        it('should classify timeout errors as retryable', () => {
            const errors = [
                new Error('Timeout error'),
                new Error('ETIMEDOUT connection refused'),
            ];
            
            errors.forEach(error => {
                const result = classifyError(error, 'deepseek');
                expect(result.type).toBe('timeout');
                expect(result.retryable).toBe(true);
            });
        });

        it('should classify billing/quota errors as retryable', () => {
            const errors = [
                new Error('Quota exceeded'),
                new Error('Insufficient credits'),
                new Error('Billing limit reached'),
            ];
            
            errors.forEach(error => {
                const result = classifyError(error, 'deepseek');
                expect(result.type).toBe('billing');
                expect(result.retryable).toBe(true);
            });
        });

        it('should classify unknown errors as retryable by default', () => {
            const error = new Error('Something unexpected happened');
            const result = classifyError(error, 'deepseek');
            
            expect(result.type).toBe('unknown');
            expect(result.retryable).toBe(true);
        });
    });

    describe('FallbackRouter', () => {
        let router: FallbackRouter;
        
        const mockProvider: OpenAICompatibleProvider = {
            chat: vi.fn().mockResolvedValue({
                content: 'Test response',
                finishReason: 'stop',
                usage: { input: 10, output: 20 },
            } as LLMResponse),
        };

        beforeEach(() => {
            router = new FallbackRouter({ maxRetries: 2, retryDelayMs: 10 });
        });

        it('should register providers and sort by priority', () => {
            router.registerProvider({
                id: 'openai',
                provider: mockProvider,
                model: 'gpt-4o',
                priority: 3,
            });
            router.registerProvider({
                id: 'deepseek',
                provider: mockProvider,
                model: 'deepseek-chat',
                priority: 1,
            });
            router.registerProvider({
                id: 'openrouter',
                provider: mockProvider,
                model: 'openrouter-model',
                priority: 2,
            });

            const providers = router.getProviders();
            expect(providers[0].id).toBe('deepseek');
            expect(providers[1].id).toBe('openrouter');
            expect(providers[2].id).toBe('openai');
        });

        it('should execute with preferred provider first', async () => {
            let callOrder: string[] = [];
            
            const provider1 = {
                chat: vi.fn().mockImplementation(() => {
                    callOrder.push('provider1');
                    throw new Error('Failed');
                }),
            } as unknown as OpenAICompatibleProvider;
            
            const provider2 = {
                chat: vi.fn().mockImplementation(() => {
                    callOrder.push('provider2');
                    return Promise.resolve({
                        content: 'Success',
                        finishReason: 'stop',
                        usage: { input: 10, output: 20 },
                    } as LLMResponse);
                }),
            } as unknown as OpenAICompatibleProvider;

            router.registerProvider({
                id: 'provider1',
                provider: provider1,
                model: 'model-1',
                priority: 2,
            });
            router.registerProvider({
                id: 'provider2',
                provider: provider2,
                model: 'model-2',
                priority: 1,
            });

            const result = await router.executeWithFallback({
                messages: [{ role: 'user', content: 'Hello' }],
                preferredProviderId: 'provider1',
            });

            expect(callOrder).toEqual(['provider1', 'provider2']);
            expect(result.providerId).toBe('provider2');
            expect(result.response.content).toBe('Success');
        });

        it('should track attempts correctly', async () => {
            const provider = {
                chat: vi.fn().mockResolvedValue({
                    content: 'Success',
                    finishReason: 'stop',
                    usage: { input: 10, output: 20 },
                } as LLMResponse),
            } as unknown as OpenAICompatibleProvider;

            router.registerProvider({
                id: 'test-provider',
                provider,
                model: 'test-model',
                priority: 1,
            });

            const result = await router.executeWithFallback({
                messages: [{ role: 'user', content: 'Hello' }],
                preferredProviderId: 'test-provider',
            });

            expect(result.attempts).toHaveLength(1);
            expect(result.attempts[0].success).toBe(true);
            expect(result.attempts[0].providerId).toBe('test-provider');
        });

        it('should indicate when no providers are registered', () => {
            expect(router.hasProviders()).toBe(false);
            
            router.registerProvider({
                id: 'test',
                provider: mockProvider,
                model: 'test',
                priority: 1,
            });
            
            expect(router.hasProviders()).toBe(true);
        });
    });
});
