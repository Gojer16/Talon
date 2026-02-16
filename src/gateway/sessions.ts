// ─── Session Manager ──────────────────────────────────────────────
// Create, resume, persist, and idle sessions

import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { TALON_HOME } from '../config/index.js';
import { SessionError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Session, SessionState, InboundMessage } from '../utils/types.js';
import type { TalonConfig } from '../config/schema.js';
import type { EventBus } from './events.js';

const SESSIONS_DIR = path.join(TALON_HOME, 'sessions');

export class SessionManager {
    private sessions = new Map<string, Session>();
    private senderIndex = new Map<string, string>(); // senderId → sessionId
    private groupIndex = new Map<string, string>();   // groupId → sessionId
    private idleTimers = new Map<string, NodeJS.Timeout>();

    constructor(
        private config: TalonConfig,
        private eventBus: EventBus,
    ) { }

    // ─── Create ───────────────────────────────────────────────────

    // ─── Create ───────────────────────────────────────────────────

    createSession(senderId: string, channel: string, senderName?: string, explicitId?: string): Session {
        const id = explicitId || `sess_${nanoid(12)}`;

        const session: Session = {
            id,
            senderId,
            channel,
            state: 'created',
            messages: [],
            memorySummary: '',
            metadata: {
                createdAt: Date.now(),
                lastActiveAt: Date.now(),
                messageCount: 0,
                model: this.config.agent.model,
            },
            config: {},
        };

        this.sessions.set(id, session);
        this.senderIndex.set(senderId, id);

        logger.info({ sessionId: id, senderId, channel }, 'Session created');
        this.eventBus.emit('session.created', { session });
        this.scheduleIdle(id);

        return session;
    }

    // ─── Lookup ───────────────────────────────────────────────────

    getSession(id: string): Session | undefined {
        return this.sessions.get(id);
    }

    getSessionBySender(senderId: string): Session | undefined {
        const id = this.senderIndex.get(senderId);
        return id ? this.sessions.get(id) : undefined;
    }

    getSessionByGroup(groupId: string): Session | undefined {
        const id = this.groupIndex.get(groupId);
        return id ? this.sessions.get(id) : undefined;
    }

    getAllSessions(): Session[] {
        return Array.from(this.sessions.values());
    }

    // ─── Route ────────────────────────────────────────────────────

    /**
     * Find or create the right session for an inbound message.
     */
    resolveSession(msg: InboundMessage): Session {
        // Group messages share a session by groupId
        if (msg.isGroup && msg.groupId) {
            const existing = this.getSessionByGroup(msg.groupId);
            if (existing) {
                this.activate(existing);
                return existing;
            }
            const session = this.createSession(msg.senderId, msg.channel, msg.senderName);
            this.groupIndex.set(msg.groupId, session.id);
            return session;
        }

        // DM: one session per sender
        const existing = this.getSessionBySender(msg.senderId);
        if (existing) {
            // If idle, resume from disk
            if (existing.state === 'idle') {
                return this.resumeSession(existing.id);
            }
            this.activate(existing);
            return existing;
        }

        return this.createSession(msg.senderId, msg.channel, msg.senderName);
    }

    // ─── Activate ─────────────────────────────────────────────────

    private activate(session: Session): void {
        session.state = 'active';
        session.metadata.lastActiveAt = Date.now();
        this.scheduleIdle(session.id);
    }

    // ─── Idle ─────────────────────────────────────────────────────

    private scheduleIdle(sessionId: string): void {
        // Clear existing timer
        const existing = this.idleTimers.get(sessionId);
        if (existing) clearTimeout(existing);

        const timeout = this.config.memory.session.idleTimeout;

        const timer = setTimeout(() => {
            this.idleSession(sessionId);
        }, timeout);

        this.idleTimers.set(sessionId, timer);
    }

    idleSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.state = 'idle';
        this.persistSession(session);
        this.eventBus.emit('session.idle', { sessionId });

        logger.info({ sessionId }, 'Session idled and persisted');
    }

    // ─── Resume ───────────────────────────────────────────────────

    resumeSession(sessionId: string): Session {
        // Try memory first
        let session = this.sessions.get(sessionId);

        if (!session) {
            // Load from disk
            const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
            if (!fs.existsSync(filePath)) {
                throw new SessionError(`Session not found: ${sessionId}`);
            }

            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                session = JSON.parse(content) as Session;
                this.sessions.set(sessionId, session);
                this.senderIndex.set(session.senderId, sessionId);
            } catch (err) {
                throw new SessionError(`Failed to load session: ${sessionId}`, { cause: err });
            }
        }

        session.state = 'active';
        session.metadata.lastActiveAt = Date.now();
        this.scheduleIdle(sessionId);

        this.eventBus.emit('session.resumed', { session });
        logger.info({ sessionId }, 'Session resumed');

        return session;
    }

    // ─── Persistence ──────────────────────────────────────────────

    persistSession(session: Session): void {
        const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);

        try {
            fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
        } catch (err) {
            logger.error({ sessionId: session.id, err }, 'Failed to persist session');
        }
    }

    /**
     * Persist all active sessions (used during shutdown).
     */
    persistAll(): void {
        for (const session of this.sessions.values()) {
            this.persistSession(session);
        }
        logger.info(`Persisted ${this.sessions.size} sessions`);
    }

    // ─── Cleanup ──────────────────────────────────────────────────

    destroy(): void {
        for (const timer of this.idleTimers.values()) {
            clearTimeout(timer);
        }
        this.idleTimers.clear();
        this.persistAll();
    }
}
