import { describe, it, expect } from 'vitest';
import { GeminiEmbeddingProvider } from '../../../src/memory/embeddings/gemini.js';

describe('Gemini Embedding Provider', () => {
  it('should require API key', () => {
    expect(() => {
      new GeminiEmbeddingProvider({ apiKey: '' });
    }).toThrow('API key is required');
  });

  it('should use default model', () => {
    const provider = new GeminiEmbeddingProvider({ apiKey: 'test-key' });
    expect(provider.model).toBe('text-embedding-004');
    expect(provider.id).toBe('gemini');
  });

  it('should use custom model', () => {
    const provider = new GeminiEmbeddingProvider({
      apiKey: 'test-key',
      model: 'text-embedding-005',
    });
    expect(provider.model).toBe('text-embedding-005');
  });
});
