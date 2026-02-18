import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { searchKeyword, buildFtsQuery } from '../../../src/memory/search/keyword.js';
import { createV2Schema } from '../../../src/memory/schema/v2.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Keyword Search', () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-keyword-${Date.now()}.db`);
    db = new Database(dbPath);
    createV2Schema(db);

    // Insert file first (foreign key requirement)
    db.prepare(`
      INSERT INTO files (path, source, hash, mtime_ms, size, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('test.md', 'memory', 'hash123', Date.now(), 1000, Date.now());

    // Insert test data
    db.prepare(`
      INSERT INTO chunks (id, file_path, source, start_line, end_line, text, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('chunk1', 'test.md', 'memory', 1, 5, 'The quick brown fox jumps over the lazy dog', 10);

    db.prepare(`
      INSERT INTO chunks (id, file_path, source, start_line, end_line, text, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('chunk2', 'test.md', 'memory', 6, 10, 'A fast red fox leaps across the sleepy canine', 10);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should search for exact keyword', async () => {
    const results = await searchKeyword({
      db,
      query: 'fox',
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain('fox');
  });

  it('should rank results by BM25 score', async () => {
    const results = await searchKeyword({
      db,
      query: 'fox',
      limit: 10,
    });

    // Results should be sorted by score (descending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should build FTS query from natural language', () => {
    expect(buildFtsQuery('hello world')).toBe('hello AND world');
    expect(buildFtsQuery('quick fox')).toBe('quick AND fox');
    expect(buildFtsQuery('"exact phrase"')).toBe('"exact phrase"');
  });

  it('should filter by source', async () => {
    // Add session file and chunk
    db.prepare(`
      INSERT INTO files (path, source, hash, mtime_ms, size, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('session.jsonl', 'sessions', 'hash456', Date.now(), 100, Date.now());

    db.prepare(`
      INSERT INTO chunks (id, file_path, source, start_line, end_line, text, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('chunk3', 'session.jsonl', 'sessions', 1, 1, 'fox in session', 3);

    const results = await searchKeyword({
      db,
      query: 'fox',
      limit: 10,
      sources: ['memory'],
    });

    expect(results.every((r) => r.source === 'memory')).toBe(true);
  });
});
