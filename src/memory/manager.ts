// ─── Memory Manager ───────────────────────────────────────────────
// Controls what context gets sent to the LLM on every call
// THE MOST IMPORTANT COMPONENT — this is what makes Talon affordable

import type { Message, Session } from '../utils/types.js';
import type { LLMMessage } from '../agent/providers/openai-compatible.js';
import { buildSystemPrompt, loadSoul } from '../agent/prompts.js';
import { logger } from '../utils/logger.js';

// ─── Config ───────────────────────────────────────────────────────

interface MemoryManagerConfig {
    workspaceRoot: string;
    maxContextTokens: number;     // Target total ~5000-6000
    maxSummaryTokens: number;     // ≤800
    keepRecentMessages: number;   // Last 5-10
    maxToolOutputTokens: number;  // ~500 per tool result
}

const DEFAULT_CONFIG: MemoryManagerConfig = {
    workspaceRoot: '~/.talon/workspace',
    maxContextTokens: 6000,
    maxSummaryTokens: 800,
    keepRecentMessages: 10,
    maxToolOutputTokens: 500,
};

// ─── Token Estimation ─────────────────────────────────────────────

/**
 * Rough token estimation (~4 chars per token for English).
 * Good enough for context budgeting — exact counts come from the API response.
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a token budget.
 */
function truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n... (truncated)';
}

// ─── Memory Manager ──────────────────────────────────────────────

export class MemoryManager {
    private config: MemoryManagerConfig;
    private soul: string;
    private availableTools: string[] = [];

    constructor(config?: Partial<MemoryManagerConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.soul = loadSoul(this.config.workspaceRoot);
    }

    /**
     * Set the available tools (for system prompt injection).
     */
    setAvailableTools(tools: string[]): void {
        this.availableTools = tools;
    }

    /**
     * Build the complete LLM message array for a session.
     *
     * This is the core function — it assembles exactly what the LLM sees:
     * 1. System prompt (~500 tokens)
     * 2. Memory summary (≤800 tokens)
     * 3. Last N messages (~2000 tokens)
     * 4. Tool results truncated (~500 tokens each)
     *
     * Total target: ~5000-6000 tokens
     */
    buildContext(session: Session): LLMMessage[] {
        const messages: LLMMessage[] = [];

        // 1. System prompt with SOUL.md
        const systemPrompt = buildSystemPrompt(
            this.soul,
            this.availableTools,
            this.config.workspaceRoot
        );
        messages.push({
            role: 'system',
            content: systemPrompt,
        });

        // 2. Memory summary (if exists)
        if (session.memorySummary) {
            const truncatedSummary = truncateToTokens(
                session.memorySummary,
                this.config.maxSummaryTokens,
            );
            messages.push({
                role: 'system',
                content: `## Memory Summary (compressed history)\n${truncatedSummary}`,
            });
        }

        // 3. Recent messages only (NOT full history)
        let recentMessages = session.messages.slice(-this.config.keepRecentMessages);

        // 🛑 CRITICAL FIX: Prevent orphaned 'tool' messages
        // If the first message is a tool result, we MUST include the assistant message that called it.
        // Otherwise, OpenAI/DeepSeek throws a 400 error.
        while (recentMessages.length > 0 && recentMessages[0].role === 'tool') {
            const firstMsg = recentMessages[0];
            const parentIndex = session.messages.indexOf(firstMsg) - 1;

            if (parentIndex >= 0) {
                const parent = session.messages[parentIndex];
                if (parent && parent.role === 'assistant' && parent.toolCalls) {
                    // Prepend the parent
                    recentMessages.unshift(parent);
                } else {
                    // Orphaned tool message with no valid parent? Drop it.
                    recentMessages.shift();
                }
            } else {
                // No parent exists? Drop it.
                recentMessages.shift();
            }
        }

        for (const msg of recentMessages) {
            if (msg.role === 'tool') {
                // Truncate tool outputs — this is a major cost saver
                messages.push({
                    role: 'tool',
                    content: truncateToTokens(msg.content, this.config.maxToolOutputTokens),
                    tool_call_id: msg.toolResults?.[0]?.metadata?.confirmation ?? 'tool',
                });
            } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                // Assistant messages with tool calls
                messages.push({
                    role: 'assistant',
                    content: msg.content || '',
                    tool_calls: msg.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function' as const,
                        function: {
                            name: tc.tool,
                            arguments: JSON.stringify(tc.args),
                        },
                    })),
                });
            } else {
                messages.push({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content,
                });
            }
        }

        // Log context stats
        const totalEstTokens = messages.reduce(
            (sum, m) => sum + estimateTokens(m.content || ''),
            0,
        );

        logger.debug({
            systemTokens: estimateTokens(systemPrompt),
            summaryTokens: estimateTokens(session.memorySummary || ''),
            recentMessages: recentMessages.length,
            totalMessages: session.messages.length,
            estimatedTokens: totalEstTokens,
        }, 'Context built');

        return messages;
    }

    /**
     * Check if the session needs memory compression.
     */
    needsCompression(session: Session): boolean {
        return session.messages.length > this.config.keepRecentMessages * 2;
    }

    /**
     * Get the messages that should be compressed (everything except recent).
     */
    getMessagesForCompression(session: Session): Message[] {
        const cutoff = session.messages.length - this.config.keepRecentMessages;
        if (cutoff <= 0) return [];
        return session.messages.slice(0, cutoff);
    }

    /**
     * Apply compression: update memory summary and remove old messages from context.
     */
    applyCompression(session: Session, newSummary: string): void {
        const keepFrom = session.messages.length - this.config.keepRecentMessages;

        if (keepFrom > 0) {
            const compressedCount = keepFrom;
            session.messages = session.messages.slice(keepFrom);
            session.memorySummary = truncateToTokens(newSummary, this.config.maxSummaryTokens);

            logger.info({
                sessionId: session.id,
                compressedMessages: compressedCount,
                remainingMessages: session.messages.length,
                summaryTokens: estimateTokens(session.memorySummary),
            }, 'Memory compressed');
        }
    }

    /**
     * Format messages for the compression prompt.
     */
    formatMessagesForCompression(messages: Message[]): string {
        return messages
            .map(m => {
                const role = m.role.toUpperCase();
                const content = truncateToTokens(m.content, 200); // Very aggressive truncation
                return `[${role}]: ${content}`;
            })
            .join('\n');
    }

    /**
     * Reload SOUL.md (called when personality is updated).
     */
    reloadSoul(): void {
        this.soul = loadSoul(this.config.workspaceRoot);
        logger.info('Reloaded SOUL.md');
    }
}
