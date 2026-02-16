// ─── Channel Base Class ───────────────────────────────────────────
// Base implementation for all input/output channels (CLI, Telegram, etc.)

import type { TalonConfig } from '../config/schema.js';
import type { EventBus } from '../gateway/events.js';
import type { SessionManager } from '../gateway/sessions.js';
import type { MessageRouter } from '../gateway/router.js';
import type { InboundMessage, OutboundMessage } from '../utils/types.js';
import { logger } from '../utils/logger.js';
import { nanoid } from 'nanoid';

export abstract class BaseChannel {
    public abstract readonly name: string;
    protected config: TalonConfig;
    protected eventBus: EventBus;
    protected sessionManager: SessionManager;
    protected router: MessageRouter;

    constructor(
        config: TalonConfig,
        eventBus: EventBus,
        sessionManager: SessionManager,
        router: MessageRouter,
    ) {
        this.config = config;
        this.eventBus = eventBus;
        this.sessionManager = sessionManager;
        this.router = router;
    }

    /**
     * Start the channel (connect to APIs, start listening, etc.)
     */
    public abstract start(): Promise<void>;

    /**
     * Stop the channel (disconnect, cleanup)
     */
    public abstract stop(): Promise<void>;

    /**
     * Send a message to the channel (outbound from agent)
     */
    public abstract send(sessionId: string, message: OutboundMessage): Promise<void>;

    /**
     * Helper to ingest an inbound message from the channel
     */
    protected async ingestMessage(
        senderId: string,
        senderName: string,
        text: string,
        metadata: {
            isGroup?: boolean;
            groupId?: string;
            media?: InboundMessage['media'];
        } = {},
    ): Promise<void> {
        const message: InboundMessage = {
            channel: this.name,
            senderId,
            senderName,
            text,
            media: metadata.media ?? null,
            isGroup: metadata.isGroup ?? false,
            groupId: metadata.groupId ?? null,
        };

        // Let the router handle session creation/retrieval and event emission
        await this.router.handleInbound(message);
    }
}
