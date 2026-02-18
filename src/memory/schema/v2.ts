import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 2;

export function createV2Schema(db: Database.Database): void {
  db.exec(`
    -- Files table: tracks indexed files
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      source TEXT NOT NULL CHECK(source IN ('memory', 'sessions')),
      hash TEXT NOT NULL,
      mtime_ms REAL NOT NULL,
      size INTEGER NOT NULL,
      indexed_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_files_source ON files(source);
    CREATE INDEX IF NOT EXISTS idx_files_indexed_at ON files(indexed_at);

    -- Chunks table: text chunks from files
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('memory', 'sessions')),
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      text TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON chunks(file_path);
    CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);

    -- FTS5 table for keyword search
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      id UNINDEXED,
      text,
      content='chunks',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS chunks_fts_insert AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, id, text) VALUES (new.rowid, new.id, new.text);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_fts_delete AFTER DELETE ON chunks BEGIN
      DELETE FROM chunks_fts WHERE rowid = old.rowid;
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_fts_update AFTER UPDATE ON chunks BEGIN
      DELETE FROM chunks_fts WHERE rowid = old.rowid;
      INSERT INTO chunks_fts(rowid, id, text) VALUES (new.rowid, new.id, new.text);
    END;

    -- Embedding cache table
    CREATE TABLE IF NOT EXISTS embedding_cache (
      key TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cache_created_at ON embedding_cache(created_at);

    -- Meta table for schema version and config
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Insert schema version
    INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '2');
  `);
}

export function dropV2Schema(db: Database.Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS chunks_fts_update;
    DROP TRIGGER IF EXISTS chunks_fts_delete;
    DROP TRIGGER IF EXISTS chunks_fts_insert;
    DROP TABLE IF EXISTS chunks_fts;
    DROP TABLE IF EXISTS embedding_cache;
    DROP TABLE IF EXISTS chunks;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS meta;
  `);
}
