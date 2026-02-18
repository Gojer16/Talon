import { describe, it, expect } from 'vitest';
import { OpenRouterEmbeddingProvider } from '../../../src/memory/embeddings/openrouter.js';

describe('OpenRouter Embedding Provider', () => {
  it('should require API key', () => {
    expect(() => {
      new OpenRouterEmbeddingProvider({ apiKey: '' });
    }).toThrow('API key is required');
  });

  it('should use default model', () => {
    const provider = new OpenRouterEmbeddingProvider({ apiKey: 'test-key' });
    expect(provider.model).toBe('openai/text-embedding-3-small');
    expect(provider.id).toBe('openrouter');
  });

  it('should use custom model', () => {
    const provider = new OpenRouterEmbeddingProvider({
      apiKey: 'test-key',
      model: 'openai/text-embedding-3-large',
    });
    expect(provider.model).toBe('openai/text-embedding-3-large');
  });
});
