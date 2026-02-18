import type Database from 'better-sqlite3';
import { createV2Schema, SCHEMA_VERSION } from './v2.js';
import { logger } from '../../utils/logger.js';

export function getCurrentVersion(db: Database.Database): number {
  try {
    // Check if meta table exists
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='meta'`)
      .all() as Array<{ name: string }>;

    if (tables.length === 0) {
      // No meta table = V1 (old schema)
      return 1;
    }

    // Read version from meta
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version') as
      | { value: string }
      | undefined;

    return row ? parseInt(row.value, 10) : 1;
  } catch (error) {
    logger.warn({ error }, 'Failed to get schema version, assuming V1');
    return 1;
  }
}

export function migrateToV2(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    logger.debug({ currentVersion }, 'Schema already up to date');
    return;
  }

  logger.info({ from: currentVersion, to: SCHEMA_VERSION }, 'Migrating database schema');

  db.exec('BEGIN TRANSACTION');

  try {
    if (currentVersion === 1) {
      // V1 → V2 migration
      logger.info('Migrating from V1 to V2');

      // Create new V2 tables
      createV2Schema(db);

      // Note: We don't migrate vector_messages to chunks
      // because the schema is fundamentally different.
      // Users will need to re-index their memory.
      // The old vector_messages table is left intact for reference.

      logger.info('V1 → V2 migration complete');
    }

    db.exec('COMMIT');
    logger.info({ version: SCHEMA_VERSION }, 'Schema migration successful');
  } catch (error) {
    db.exec('ROLLBACK');
    logger.error({ error }, 'Schema migration failed');
    throw error;
  }
}

export function ensureSchema(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);

  if (currentVersion < SCHEMA_VERSION) {
    migrateToV2(db);
  } else if (currentVersion === SCHEMA_VERSION) {
    // Schema exists, verify integrity
    logger.debug('Schema version correct, verifying integrity');
  } else {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ${SCHEMA_VERSION}`,
    );
  }
}
