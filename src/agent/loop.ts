// ─── Agent Loop State Machine ─────────────────────────────────────
// The core brain: PLAN → DECIDE → EXECUTE → EVALUATE → COMPRESS → RESPOND
// This is what makes Talon feel like a real agent, not a chatbot

import type { Session, Message } from '../utils/types.js';
import type { EventBus } from '../gateway/events.js';
import type { ModelRouter } from './router.js';
import type { MemoryManager } from '../memory/manager.js';
import type { MemoryCompressor } from '../memory/compressor.js';
import type { LLMTool, LLMResponse, LLMStreamChunk } from './providers/openai-compatible.js';
import { logger } from '../utils/logger.js';

// ─── Types ────────────────────────────────────────────────────────

export type LoopState =
    | 'idle'
    | 'thinking'     // Building context, deciding approach
    | 'executing'    // Making LLM call (possibly with tools)
    | 'evaluating'   // Checking if result is complete
    | 'compressing'  // Memory compression
    | 'responding'   // Sending final response
    | 'error';

export interface AgentChunk {
    type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
    content?: string;
    toolCall?: { id: string; name: string; args: Record<string, unknown> };
    toolResult?: { id: string; output: string; success: boolean };
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    iteration?: number;
}

interface ToolHandler {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
}

// ─── Agent Loop ───────────────────────────────────────────────────

export class AgentLoop {
    private state: LoopState = 'idle';
    private tools = new Map<string, ToolHandler>();
    private maxIterations: number;

    constructor(
        private modelRouter: ModelRouter,
        private memoryManager: MemoryManager,
        private memoryCompressor: MemoryCompressor,
        private eventBus: EventBus,
        options?: { maxIterations?: number },
    ) {
        this.maxIterations = options?.maxIterations ?? 10;
    }

    // ─── Tool Registration ──────────────────────────────────────

    registerTool(tool: ToolHandler): void {
        this.tools.set(tool.name, tool);
        logger.info({ tool: tool.name }, 'Tool registered');
    }

    getToolDefinitions(): LLMTool[] {
        return Array.from(this.tools.values()).map(t => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }

    // ─── Main Loop ──────────────────────────────────────────────

    /**
     * Run the agent loop for a user message.
     * Yields AgentChunks as the agent thinks, calls tools, and responds.
     */
    async *run(session: Session): AsyncIterable<AgentChunk> {
        this.state = 'thinking';
        this.eventBus.emit('agent.thinking', { sessionId: session.id });

        // Check if we need memory compression first
        if (this.memoryManager.needsCompression(session)) {
            yield* this.compressMemory(session);
        }

        // Get the LLM provider
        const route = this.modelRouter.getDefaultProvider();
        if (!route) {
            this.state = 'error';
            yield {
                type: 'error',
                content: 'No LLM provider configured. Run `talon setup` to configure one.',
            };
            return;
        }

        // Set available tools for the system prompt
        this.memoryManager.setAvailableTools(
            Array.from(this.tools.values()).map(t => `${t.name}: ${t.description}`),
        );

        let iteration = 0;

        while (iteration < this.maxIterations) {
            iteration++;
            this.state = 'executing';

            logger.info({
                sessionId: session.id,
                iteration,
                provider: route.providerId,
                model: route.model,
            }, 'Agent loop iteration');

            yield { type: 'thinking', content: `Iteration ${iteration}...`, iteration };

            // Build context (Memory Manager controls what the LLM sees)
            const context = this.memoryManager.buildContext(session);

            // Make LLM call with tools
            let response: LLMResponse;
            try {
                response = await route.provider.chat(context, {
                    model: route.model,
                    tools: this.tools.size > 0 ? this.getToolDefinitions() : undefined,
                });
            } catch (err) {
                this.state = 'error';
                const message = err instanceof Error ? err.message : String(err);
                logger.error({ err, iteration }, 'LLM call failed');
                yield { type: 'error', content: `LLM error: ${message}` };
                return;
            }

            // Log usage
            if (response.usage) {
                logger.info({
                    iteration,
                    promptTokens: response.usage.promptTokens,
                    completionTokens: response.usage.completionTokens,
                    totalTokens: response.usage.totalTokens,
                }, 'LLM usage');
            }

            // ─── Handle Tool Calls ────────────────────────────────

            if (response.toolCalls.length > 0) {
                // Add assistant message with tool calls to history
                const assistantMsg: Message = {
                    id: `msg_${Date.now().toString(36)}_${iteration}`,
                    role: 'assistant',
                    content: response.content ?? '',
                    toolCalls: response.toolCalls.map(tc => ({
                        id: tc.id,
                        tool: tc.name,
                        args: tc.args,
                    })),
                    timestamp: Date.now(),
                };
                session.messages.push(assistantMsg);

                // Execute each tool call
                for (const tc of response.toolCalls) {
                    yield {
                        type: 'tool_call',
                        toolCall: { id: tc.id, name: tc.name, args: tc.args },
                        iteration,
                    };

                    const toolHandler = this.tools.get(tc.name);
                    let output: string;
                    let success: boolean;

                    if (toolHandler) {
                        try {
                            this.eventBus.emit('tool.execute', {
                                sessionId: session.id,
                                tool: tc.name,
                                args: tc.args,
                            });

                            output = await toolHandler.execute(tc.args);
                            success = true;

                            this.eventBus.emit('tool.complete', {
                                sessionId: session.id,
                                tool: tc.name,
                                result: {
                                    success: true,
                                    output,
                                    metadata: { executionTime: 0 },
                                },
                            });
                        } catch (err) {
                            output = `Error: ${err instanceof Error ? err.message : String(err)}`;
                            success = false;
                        }
                    } else {
                        output = `Error: Unknown tool "${tc.name}"`;
                        success = false;
                    }

                    yield {
                        type: 'tool_result',
                        toolResult: { id: tc.id, output, success },
                        iteration,
                    };

                    // Add tool result to session history
                    const toolMsg: Message = {
                        id: `msg_${Date.now().toString(36)}_tool`,
                        role: 'tool',
                        content: output,
                        toolResults: [{
                            success,
                            output,
                            metadata: {
                                executionTime: 0,
                                confirmation: tc.id,
                            },
                        }],
                        timestamp: Date.now(),
                    };
                    session.messages.push(toolMsg);
                }

                // Continue loop — let the LLM see tool results and decide next action
                continue;
            }

            // ─── No Tool Calls → Final Response ───────────────────

            this.state = 'evaluating';

            if (response.content) {
                // Add assistant response to session history
                session.messages.push({
                    id: `msg_${Date.now().toString(36)}_resp`,
                    role: 'assistant',
                    content: response.content,
                    timestamp: Date.now(),
                });

                session.metadata.messageCount++;

                // Stream the response
                yield {
                    type: 'text',
                    content: response.content,
                    iteration,
                };
            }

            // Done!
            this.state = 'responding';
            yield {
                type: 'done',
                usage: response.usage,
                iteration,
            };

            this.state = 'idle';
            return;
        }

        // Max iterations reached
        this.state = 'idle';
        logger.warn({
            sessionId: session.id,
            maxIterations: this.maxIterations,
        }, 'Max iterations reached');

        yield {
            type: 'text',
            content: 'I reached my maximum iteration limit. Here\'s what I have so far — let me know if you\'d like me to continue.',
            iteration,
        };
        yield { type: 'done', iteration };
    }

    // ─── Memory Compression ─────────────────────────────────────

    private async *compressMemory(session: Session): AsyncIterable<AgentChunk> {
        this.state = 'compressing';

        logger.info({ sessionId: session.id }, 'Starting memory compression');

        const messagesToCompress = this.memoryManager.getMessagesForCompression(session);

        if (messagesToCompress.length === 0) return;

        const formatted = this.memoryManager.formatMessagesForCompression(messagesToCompress);

        const newSummary = await this.memoryCompressor.compress(
            session.memorySummary,
            messagesToCompress,
            () => formatted,
        );

        this.memoryManager.applyCompression(session, newSummary);

        yield {
            type: 'thinking',
            content: `Compressed ${messagesToCompress.length} old messages into memory summary`,
        };
    }

    // ─── State ──────────────────────────────────────────────────

    getState(): LoopState {
        return this.state;
    }
}
