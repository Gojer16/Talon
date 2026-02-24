import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '@/cli/providers.js';

describe('CLI provider catalog', () => {
    it('should include OpenAI provider', () => {
        const openai = PROVIDERS.find(provider => provider.id === 'openai');
        expect(openai).toBeDefined();
    });

    it('should expose Codex and thinking models for OpenAI setup', () => {
        const openai = PROVIDERS.find(provider => provider.id === 'openai');
        expect(openai).toBeDefined();

        const modelIds = (openai?.models ?? []).map(model => model.id);
        expect(modelIds).toContain('gpt-5.1-thinking');
        expect(modelIds).toContain('gpt-5.3-codex');
        expect(modelIds).toContain('gpt-5.1-codex-mini');
    });

    it('should default OpenAI setup model to planning model', () => {
        const openai = PROVIDERS.find(provider => provider.id === 'openai');
        const defaultModel = openai?.models.find(model => model.isDefault);
        expect(defaultModel?.id).toBe('gpt-5.1-thinking');
    });
});
