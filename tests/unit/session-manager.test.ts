// ─── Session Manager Tests ────────────────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '@/gateway/sessions.js';
import { EventBus } from '@/gateway/events.js';
import type { TalonConfig } from '@/config/schema.js';

describe('SessionManager', () => {
    let sessionManager: SessionManager;
    let mockConfig: TalonConfig;
    let eventBus: EventBus;

    beforeEach(() => {
        // Create mock config
        mockConfig = {
            agent: {
                model: 'deepseek-chat',
                providers: {
                    deepseek: {
                        apiKey: 'test-key',
                        models: ['deepseek-chat'],
                    },
                },
            },
            memory: {
                session: {
                    idleTimeout: 300000, // 5 minutes
                },
            },
        } as TalonConfig;

        eventBus = new EventBus();
        sessionManager = new SessionManager(mockConfig, eventBus);
    });

    describe('createSession', () => {
        it('should create a new session', () => {
            const session = sessionManager.createSession('user-123', 'test-channel');
            
            expect(session.id).toBeDefined();
            expect(session.senderId).toBe('user-123');
            expect(session.channel).toBe('test-channel');
            expect(session.messages).toEqual([]);
            expect(session.memorySummary).toBe('');
        });

        it('should generate unique session IDs', () => {
            const session1 = sessionManager.createSession('user-1', 'channel-1');
            const session2 = sessionManager.createSession('user-2', 'channel-2');
            
            expect(session1.id).not.toBe(session2.id);
        });

        it('should emit session.created event', () => {
            const handler = vi.fn();
            eventBus.on('session.created', handler);

            sessionManager.createSession('user-123', 'test-channel');

            expect(handler).toHaveBeenCalledOnce();
        });
    });

    describe('getSession', () => {
        it('should retrieve existing session', () => {
            const created = sessionManager.createSession('user-123', 'test-channel');
            const retrieved = sessionManager.getSession(created.id);
            
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(created.id);
        });

        it('should return undefined for non-existent session', () => {
            const retrieved = sessionManager.getSession('non-existent');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getSessionBySender', () => {
        it('should retrieve session by sender ID', () => {
            const created = sessionManager.createSession('user-123', 'test-channel');
            const retrieved = sessionManager.getSessionBySender('user-123');
            
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(created.id);
        });

        it('should return undefined for unknown sender', () => {
            const retrieved = sessionManager.getSessionBySender('unknown');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getAllSessions', () => {
        it('should return all sessions', () => {
            sessionManager.createSession('user-1', 'channel-1');
            sessionManager.createSession('user-2', 'channel-2');
            sessionManager.createSession('user-3', 'channel-3');

            const sessions = sessionManager.getAllSessions();
            expect(sessions.length).toBe(3);
        });

        it('should return empty array when no sessions', () => {
            const sessions = sessionManager.getAllSessions();
            expect(sessions).toEqual([]);
        });
    });

    describe('resolveSession', () => {
        it('should create new session for new sender', () => {
            const msg = {
                senderId: 'user-123',
                channel: 'test-channel',
                content: 'Hello',
                isGroup: false,
            };

            const session = sessionManager.resolveSession(msg);
            
            expect(session).toBeDefined();
            expect(session.senderId).toBe('user-123');
        });

        it('should return existing session for known sender', () => {
            const msg = {
                senderId: 'user-123',
                channel: 'test-channel',
                content: 'Hello',
                isGroup: false,
            };

            const session1 = sessionManager.resolveSession(msg);
            const session2 = sessionManager.resolveSession(msg);
            
            expect(session1.id).toBe(session2.id);
        });
    });
});
