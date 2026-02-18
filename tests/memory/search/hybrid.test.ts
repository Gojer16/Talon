import { describe, it, expect } from 'vitest';
import { mergeHybridResults } from '../../../src/memory/search/hybrid.js';
import type { VectorSearchResult } from '../../../src/memory/search/vector.js';
import type { KeywordSearchResult } from '../../../src/memory/search/keyword.js';

describe('Hybrid Search', () => {
  it('should merge vector and keyword results', () => {
    const vectorResults: VectorSearchResult[] = [
      {
        id: 'chunk1',
        path: 'test.md',
        startLine: 1,
        endLine: 5,
        source: 'memory',
        text: 'Vector result',
        score: 0.9,
      },
    ];

    const keywordResults: KeywordSearchResult[] = [
      {
        id: 'chunk2',
        path: 'test.md',
        startLine: 6,
        endLine: 10,
        source: 'memory',
        text: 'Keyword result',
        score: 0.8,
      },
    ];

    const merged = mergeHybridResults(vectorResults, keywordResults, { vector: 0.7, keyword: 0.3 }, 10);

    expect(merged.length).toBe(2);
    expect(merged[0].id).toBe('chunk1'); // Higher weighted score
  });

  it('should combine scores for same chunk', () => {
    const vectorResults: VectorSearchResult[] = [
      {
        id: 'chunk1',
        path: 'test.md',
        startLine: 1,
        endLine: 5,
        source: 'memory',
        text: 'Same chunk',
        score: 0.8,
      },
    ];

    const keywordResults: KeywordSearchResult[] = [
      {
        id: 'chunk1',
        path: 'test.md',
        startLine: 1,
        endLine: 5,
        source: 'memory',
        text: 'Same chunk',
        score: 0.6,
      },
    ];

    const merged = mergeHybridResults(vectorResults, keywordResults, { vector: 0.7, keyword: 0.3 }, 10);

    expect(merged.length).toBe(1);
    expect(merged[0].score).toBeCloseTo(0.8 * 0.7 + 0.6 * 0.3);
    expect(merged[0].vectorScore).toBe(0.8);
    expect(merged[0].keywordScore).toBe(0.6);
  });

  it('should respect limit', () => {
    const vectorResults: VectorSearchResult[] = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `chunk${i}`,
        path: 'test.md',
        startLine: i,
        endLine: i + 1,
        source: 'memory' as const,
        text: `Result ${i}`,
        score: 0.5,
      }));

    const merged = mergeHybridResults(vectorResults, [], { vector: 1, keyword: 0 }, 5);

    expect(merged.length).toBe(5);
  });
});
