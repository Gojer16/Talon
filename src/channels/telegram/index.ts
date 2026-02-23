// ─── Telegram Channel ─────────────────────────────────────────────
// Lightweight implementation using long-polling via fetch (no heavy deps)

import { BaseChannel } from '../base.js';
import type { OutboundMessage } from '../../utils/types.js';
import { logger } from '../../utils/logger.js';

interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from?: {
            id: number;
            first_name: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
            title?: string;
        };
        date: number;
        text?: string;
    };
}

interface TelegramResponse<T> {
    ok: boolean;
    result: T;
    description?: string;
}

export class TelegramChannel extends BaseChannel {
    public readonly name = 'telegram';
    private offset = 0;
    private isPolling = false;
    private pollingTimeout: NodeJS.Timeout | null = null;

    public async start(): Promise<void> {
        if (!this.config.channels.telegram.enabled) {
            return;
        }

        const token = this.config.channels.telegram.botToken;
        if (!token) {
            logger.error('Telegram enabled but no bot token provided');
            return;
        }

        logger.info('Starting Telegram polling...');
        this.isPolling = true;
        this.poll();
    }

    public async stop(): Promise<void> {
        this.isPolling = false;
        if (this.pollingTimeout) {
            clearTimeout(this.pollingTimeout);
        }
    }

    public async send(sessionId: string, message: OutboundMessage): Promise<void> {
        // Retrieve session to get the real chat ID (senderId)
        const session = this.sessionManager.getSession(sessionId);
        if (!session) {
            logger.error({ sessionId }, 'Session not found for outbound Telegram message');
            return;
        }

        const chatId = session.senderId;
        const token = this.config.channels.telegram.botToken;
        const text = this.stripMarkdown(message.text);

        if (!token || !chatId) return;

        // CHAN-002: Split messages into chunks ≤ 4096 chars (Telegram limit)
        const MAX_TELEGRAM_LENGTH = 4096;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += MAX_TELEGRAM_LENGTH) {
            chunks.push(text.slice(i, i + MAX_TELEGRAM_LENGTH));
        }

        try {
            // Send each chunk as a separate message
            for (const chunk of chunks) {
                await this.callApi(token, 'sendMessage', {
                    chat_id: chatId,
                    text: chunk,
                });
            }
            logger.info({ chatId, chunks: chunks.length }, 'Telegram message sent');
        } catch (err) {
            logger.error({ err, chatId }, 'Failed to send Telegram message');
        }
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/^#{1,6}\s+/gm, '')
            // CHAN-004: Preserve code block content instead of removing it
            .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^\s*[-*+]\s+/gm, '  ')
            .replace(/^\s*\d+\.\s+/gm, '  ')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // ─── Polling Logic ────────────────────────────────────────────

    private async poll(): Promise<void> {
        if (!this.isPolling) return;

        const token = this.config.channels.telegram.botToken;
        if (!token) return;

        try {
            const updates = await this.callApi<TelegramUpdate[]>(token, 'getUpdates', {
                offset: this.offset,
                timeout: 30, // Long polling timeout (seconds)
                allowed_updates: ['message'],
            });

            for (const update of updates) {
                // Update offset to acknowledge processing
                this.offset = update.update_id + 1;
                await this.handleUpdate(update);
            }
        } catch (err) {
            // Log error but keep polling (with backoff)
            logger.error({ err }, 'Telegram polling error');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Schedule next poll immediately (or with small delay)
        if (this.isPolling) {
            this.pollingTimeout = setTimeout(() => this.poll(), 100);
        }
    }

    private async handleUpdate(update: TelegramUpdate): Promise<void> {
        const msg = update.message;
        if (!msg || !msg.text) return; // Only handle text messages for now

        const chatId = msg.chat.id.toString();
        const userId = msg.from?.id.toString();
        const username = msg.from?.username || msg.from?.first_name || 'Unknown';
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

        // Check explicit allowances
        const allowedUsers = this.config.channels.telegram.allowedUsers;
        const allowedGroups = this.config.channels.telegram.allowedGroups;

        if (isGroup) {
            if (allowedGroups.length > 0 && !allowedGroups.includes(chatId)) {
                // Ignore unauthorized groups
                return;
            }
            // Check group activation strategy
            const activation = this.config.channels.telegram.groupActivation;
            if (activation === 'mention') {
                // Check if bot is mentioned? (Need bot username for robust check)
                // For now, simple implementation: assume all messages in allowed group are meant for bot if strict mode is off
                // Or we can check if text starts with '/' or '@botname'
                // TODO: Implement proper mention check
            }
        } else {
            // DM
            if (allowedUsers.length > 0 && userId && !allowedUsers.includes(userId)) {
                // Ignore unauthorized users
                logger.warn({ userId, username }, 'Ignoring message from unauthorized Telegram user');
                return;
            }
        }

        // Ingest
        await this.ingestMessage(chatId, username, msg.text, {
            isGroup,
            groupId: isGroup ? chatId : undefined,
        });
    }

    // ─── API Helper ───────────────────────────────────────────────

    private async callApi<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
        const url = `https://api.telegram.org/bot${token}/${method}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json() as TelegramResponse<T>;

        if (!data.ok) {
            throw new Error(`Telegram API Error: ${data.description}`);
        }

        return data.result;
    }
}
