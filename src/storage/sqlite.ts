// ─── SQLite Storage Layer ────────────────────────────────────────
// Better-sqlite3 wrapper for session and message persistence

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { TALON_HOME } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { Session, Message } from '../utils/types.js';

const DB_PATH = path.join(TALON_HOME, 'talon.db');
const SCHEMA_PATH = path.join(import.meta.dirname, 'schema.sql');

export class SqliteStore {
    private db: Database.Database;

    constructor(dbPath: string = DB_PATH) {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Open database
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
        this.db.pragma('foreign_keys = ON');

        // Initialize schema
        this.initSchema();

        logger.info({ dbPath }, 'SQLite database initialized');
    }

    private initSchema(): void {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        this.db.exec(schema);
    }

    // ─── Sessions ─────────────────────────────────────────────────

    saveSession(session: Session): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO sessions (
                id, sender_id, channel, state, memory_summary,
                created_at, last_active_at, message_count, model, config
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            session.id,
            session.senderId,
            session.channel,
            session.state,
            session.memorySummary,
            session.metadata.createdAt,
            session.metadata.lastActiveAt,
            session.metadata.messageCount,
            session.metadata.model,
            JSON.stringify(session.config)
        );
    }

    getSession(id: string): Session | null {
        const stmt = this.db.prepare(`
            SELECT * FROM sessions WHERE id = ?
        `);

        const row = stmt.get(id) as any;
        if (!row) return null;

        return this.rowToSession(row);
    }

    getSessionBySender(senderId: string): Session | null {
        const stmt = this.db.prepare(`
            SELECT * FROM sessions WHERE sender_id = ? ORDER BY last_active_at DESC LIMIT 1
        `);

        const row = stmt.get(senderId) as any;
        if (!row) return null;

        return this.rowToSession(row);
    }

    getAllSessions(): Session[] {
        const stmt = this.db.prepare(`
            SELECT * FROM sessions ORDER BY last_active_at DESC
        `);

        const rows = stmt.all() as any[];
        return rows.map(row => this.rowToSession(row));
    }

    getActiveSessions(): Session[] {
        const stmt = this.db.prepare(`
            SELECT * FROM sessions WHERE state = 'active' ORDER BY last_active_at DESC
        `);

        const rows = stmt.all() as any[];
        return rows.map(row => this.rowToSession(row));
    }

    deleteSession(id: string): void {
        const stmt = this.db.prepare(`DELETE FROM sessions WHERE id = ?`);
        stmt.run(id);
    }

    private rowToSession(row: any): Session {
        return {
            id: row.id,
            senderId: row.sender_id,
            channel: row.channel,
            state: row.state,
            messages: this.getMessages(row.id),
            memorySummary: row.memory_summary,
            metadata: {
                createdAt: row.created_at,
                lastActiveAt: row.last_active_at,
                messageCount: row.message_count,
                model: row.model,
            },
            config: JSON.parse(row.config),
        };
    }

    // ─── Messages ─────────────────────────────────────────────────

    saveMessage(sessionId: string, message: Message): void {
        const stmt = this.db.prepare(`
            INSERT INTO messages (
                id, session_id, role, content, timestamp, tool_calls
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            message.id || `msg_${Date.now()}`,
            sessionId,
            message.role,
            message.content,
            message.timestamp,
            message.toolCalls ? JSON.stringify(message.toolCalls) : null
        );
    }

    getMessages(sessionId: string): Message[] {
        const stmt = this.db.prepare(`
            SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC
        `);

        const rows = stmt.all(sessionId) as any[];
        return rows.map(row => ({
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: row.timestamp,
            toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
        }));
    }

    deleteMessages(sessionId: string): void {
        const stmt = this.db.prepare(`DELETE FROM messages WHERE session_id = ?`);
        stmt.run(sessionId);
    }

    // ─── Migration ────────────────────────────────────────────────

    /**
     * Migrate sessions from file-based storage to SQLite
     */
    migrateFromFiles(sessionsDir: string): number {
        if (!fs.existsSync(sessionsDir)) {
            return 0;
        }

        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
        let migrated = 0;

        for (const file of files) {
            try {
                const filePath = path.join(sessionsDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const session = JSON.parse(content) as Session;

                // Save session
                this.saveSession(session);

                // Save messages
                for (const message of session.messages) {
                    this.saveMessage(session.id, message);
                }

                migrated++;
                logger.info({ sessionId: session.id }, 'Migrated session from file');
            } catch (err) {
                logger.error({ file, err }, 'Failed to migrate session');
            }
        }

        return migrated;
    }

    // ─── Stats ────────────────────────────────────────────────────

    getStats(): {
        totalSessions: number;
        activeSessions: number;
        totalMessages: number;
        dbSize: number;
    } {
        const sessions = this.db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as any;
        const active = this.db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE state = 'active'`).get() as any;
        const messages = this.db.prepare(`SELECT COUNT(*) as count FROM messages`).get() as any;

        let dbSize = 0;
        try {
            const stats = fs.statSync(DB_PATH);
            dbSize = stats.size;
        } catch (err) {
            // Ignore
        }

        return {
            totalSessions: sessions.count,
            activeSessions: active.count,
            totalMessages: messages.count,
            dbSize,
        };
    }

    // ─── Lifecycle ────────────────────────────────────────────────

    close(): void {
        this.db.close();
        logger.info('SQLite database closed');
    }

    vacuum(): void {
        this.db.exec('VACUUM');
        logger.info('SQLite database vacuumed');
    }
}
