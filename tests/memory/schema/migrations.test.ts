import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrateToV2, getCurrentVersion } from '../../../src/memory/schema/migrations.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Schema Migrations', () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-memory-${Date.now()}.db`);
    db = new Database(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should migrate from V1 to V2 schema', () => {
    // Create V1 schema (current Talon schema)
    db.exec(`
      CREATE TABLE IF NOT EXISTS vector_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        role TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Verify V1
    expect(getCurrentVersion(db)).toBe(1);

    // Migrate to V2
    migrateToV2(db);

    // Verify V2 tables exist
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('files');
    expect(tableNames).toContain('chunks');
    expect(tableNames).toContain('chunks_fts');
    expect(tableNames).toContain('embedding_cache');
    expect(tableNames).toContain('meta');

    // Verify version updated
    expect(getCurrentVersion(db)).toBe(2);
  });

  it('should preserve existing data during migration', () => {
    // Create V1 schema with data
    db.exec(`
      CREATE TABLE vector_messages (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        message_id TEXT,
        content TEXT,
        role TEXT,
        timestamp INTEGER
      );
      INSERT INTO vector_messages VALUES (1, 'sess1', 'msg1', 'Hello', 'user', 1000);
    `);

    migrateToV2(db);

    // Verify data preserved
    const row = db.prepare('SELECT * FROM vector_messages WHERE message_id = ?').get('msg1');
    expect(row).toBeDefined();
    expect((row as any).content).toBe('Hello');
  });

  it('should not re-migrate if already V2', () => {
    // Migrate once
    migrateToV2(db);
    const version1 = getCurrentVersion(db);

    // Try to migrate again
    migrateToV2(db);
    const version2 = getCurrentVersion(db);

    expect(version1).toBe(2);
    expect(version2).toBe(2);
  });
});
