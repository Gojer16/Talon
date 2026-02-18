// src/tui/utils/fuzzy.ts
import Fuse from 'fuse.js';

export interface FuzzySearchOptions<T> {
  keys: string[];
  threshold?: number;
  limit?: number;
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
  matches: Array<{
    key: string;
    indices: [number, number][];
  }>;
}

export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions<T>
): FuzzyResult<T>[] {
  const { keys, threshold = 0.4, limit = 10 } = options;

  if (!query.trim()) {
    return items.slice(0, limit).map(item => ({
      item,
      score: 0,
      matches: [],
    }));
  }

  const fuse = new Fuse(items, {
    keys,
    threshold,
    includeScore: true,
    includeMatches: true,
  });

  const results = fuse.search(query, { limit });

  return results.map(result => ({
    item: result.item,
    score: result.score || 0,
    matches: (result.matches || []).map(match => ({
      key: match.key || '',
      indices: match.indices || [],
    })),
  }));
}

export function highlightMatches(
  text: string,
  indices: [number, number][],
  highlightFn: (text: string) => string
): string {
  if (!indices.length) return text;

  let result = '';
  let lastIndex = 0;

  for (const [start, end] of indices) {
    result += text.slice(lastIndex, start);
    result += highlightFn(text.slice(start, end + 1));
    lastIndex = end + 1;
  }

  result += text.slice(lastIndex);
  return result;
}
