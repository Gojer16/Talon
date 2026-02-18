import type { KeywordSearchResult } from './keyword.js';
import type { VectorSearchResult } from './vector.js';

export interface HybridSearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: string;
  text: string;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
}

export interface HybridSearchWeights {
  vector: number; // 0-1
  keyword: number; // 0-1
}

const DEFAULT_WEIGHTS: HybridSearchWeights = {
  vector: 0.7,
  keyword: 0.3,
};

/**
 * Merge vector and keyword search results with weighted scoring.
 *
 * Algorithm:
 * 1. Create map of all unique chunks
 * 2. For each chunk, compute weighted score
 * 3. Sort by final score
 * 4. Return top-k results
 */
export function mergeHybridResults(
  vectorResults: VectorSearchResult[],
  keywordResults: KeywordSearchResult[],
  weights: HybridSearchWeights = DEFAULT_WEIGHTS,
  limit: number,
): HybridSearchResult[] {
  const resultMap = new Map<string, HybridSearchResult>();

  // Add vector results
  for (const result of vectorResults) {
    resultMap.set(result.id, {
      id: result.id,
      path: result.path,
      startLine: result.startLine,
      endLine: result.endLine,
      source: result.source,
      text: result.text,
      score: result.score * weights.vector,
      vectorScore: result.score,
    });
  }

  // Add/merge keyword results
  for (const result of keywordResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      // Merge scores
      existing.score += result.score * weights.keyword;
      existing.keywordScore = result.score;
    } else {
      // New result
      resultMap.set(result.id, {
        id: result.id,
        path: result.path,
        startLine: result.startLine,
        endLine: result.endLine,
        source: result.source,
        text: result.text,
        score: result.score * weights.keyword,
        keywordScore: result.score,
      });
    }
  }

  // Sort by score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
