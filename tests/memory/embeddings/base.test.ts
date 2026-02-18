import { describe, it, expect } from 'vitest';
import { normalizeEmbedding } from '../../../src/memory/embeddings/base.js';

describe('Embedding Base', () => {
  it('should normalize embedding to unit length', () => {
    const embedding = [3, 4]; // Length = 5
    const normalized = normalizeEmbedding(embedding);

    expect(normalized[0]).toBeCloseTo(0.6);
    expect(normalized[1]).toBeCloseTo(0.8);

    // Verify unit length
    const magnitude = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
    expect(magnitude).toBeCloseTo(1.0);
  });

  it('should handle zero vector', () => {
    const embedding = [0, 0, 0];
    const normalized = normalizeEmbedding(embedding);

    expect(normalized).toEqual([0, 0, 0]);
  });
});
