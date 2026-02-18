import type Database from 'better-sqlite3';
import type { MemorySource } from '../sync/types.js';

export interface KeywordSearchOptions {
  db: Database.Database;
  query: string;
  limit: number;
  sources?: MemorySource[];
}

export interface KeywordSearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: MemorySource;
  text: string;
  score: number;
}

/**
 * Convert BM25 rank to 0-1 score.
 * BM25 returns negative scores (lower = better).
 */
export function bm25RankToScore(rank: number): number {
  const normalized = Math.max(0, -rank);
  return Math.min(1, normalized / 10);
}

/**
 * Build FTS5 query from natural language.
 * Converts "hello world" to "hello AND world"
 */
export function buildFtsQuery(raw: string): string {
  // Handle quoted phrases
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw;
  }

  // Split into words and join with AND
  const words = raw
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return '';
  }

  return words.join(' AND ');
}

/**
 * Search chunks using FTS5 keyword search with BM25 ranking.
 */
export async function searchKeyword(
  options: KeywordSearchOptions,
): Promise<KeywordSearchResult[]> {
  const { db, query, limit, sources } = options;

  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) {
    return [];
  }

  // Build SQL with optional source filter
  let sql = `
    SELECT
      c.id,
      c.file_path as path,
      c.start_line as startLine,
      c.end_line as endLine,
      c.source,
      c.text,
      bm25(chunks_fts) as rank
    FROM chunks_fts
    JOIN chunks c ON chunks_fts.rowid = c.rowid
    WHERE chunks_fts MATCH ?
  `;

  const params: any[] = [ftsQuery];

  if (sources && sources.length > 0) {
    const placeholders = sources.map(() => '?').join(',');
    sql += ` AND c.source IN (${placeholders})`;
    params.push(...sources);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    path: string;
    startLine: number;
    endLine: number;
    source: MemorySource;
    text: string;
    rank: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    startLine: row.startLine,
    endLine: row.endLine,
    source: row.source,
    text: row.text,
    score: bm25RankToScore(row.rank),
  }));
}
