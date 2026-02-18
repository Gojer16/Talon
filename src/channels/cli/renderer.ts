// ─── Terminal Renderer ────────────────────────────────────────────
// Single source of truth for all terminal output rendering.
// Both CLI and TUI use this — add display logic here ONCE.

import chalk from 'chalk';
import readline from 'node:readline';
import path from 'node:path';
import { formatAIResponse } from './utils.js';

// ─── Types ───────────────────────────────────────────────────────

/** Normalized chunk that the renderer knows how to display */
export interface RenderChunk {
    type: 'text' | 'thinking' | 'error' | 'tool_call' | 'tool_result' | 'done';
    content?: string;
    toolCall?: { id: string; name: string; args: Record<string, unknown> };
    toolResult?: { id: string; output: string; success: boolean };
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    providerId?: string;
    model?: string;
    iteration?: number;
}

export interface RendererOptions {
    /** Max time (ms) to wait for a response before showing timeout. Default: 120000 */
    responseTimeoutMs?: number;
    /** Current model name for display */
    currentModel?: string;
}

// ─── Renderer ────────────────────────────────────────────────────

/**
 * Shared terminal renderer for CLI and TUI.
 * Handles all display logic: tool calls, responses, errors, timeouts.
 * 
 * Usage:
 *   const renderer = new TerminalRenderer(() => rl.prompt());
 *   renderer.handleChunk(chunk);      // process any chunk type
 *   renderer.startWaiting();          // call when user sends message
 */
export class TerminalRenderer {
    private responseBuffer = '';
    private toolResultsBuffer: Array<{ name: string; output: string; success: boolean }> = [];
    private responseTimeout: ReturnType<typeof setTimeout> | null = null;
    private isWaiting = false;
    private timeoutMs: number;

    public currentModel = 'unknown';

    constructor(
        /** Callback to re-show the prompt after output */
        private onPrompt: () => void,
        options?: RendererOptions,
    ) {
        this.timeoutMs = options?.responseTimeoutMs ?? 120_000;
        if (options?.currentModel) {
            this.currentModel = options.currentModel;
        }
    }

    // ─── Public API ──────────────────────────────────────────────

    /**
     * Handle an incoming chunk from the agent loop.
     * This is the SINGLE entry point for all display logic.
     */
    handleChunk(chunk: RenderChunk): void {
        switch (chunk.type) {
            case 'text':
                this.handleText(chunk);
                break;
            case 'thinking':
                this.handleThinking(chunk);
                break;
            case 'error':
                this.handleError(chunk);
                break;
            case 'tool_call':
                this.handleToolCall(chunk);
                break;
            case 'tool_result':
                this.handleToolResult(chunk);
                break;
            case 'done':
                this.handleDone(chunk);
                break;
        }
    }

    /** Call when user sends a message — starts the response timeout */
    startWaiting(): void {
        this.isWaiting = true;
        this.responseBuffer = '';
        this.toolResultsBuffer = [];
        this.startTimeout();
    }

    /** Reset all state (e.g. on /clear or /reset) */
    reset(): void {
        this.responseBuffer = '';
        this.toolResultsBuffer = [];
        this.isWaiting = false;
        this.clearTimeout();
    }

    // ─── Chunk Handlers ──────────────────────────────────────────

    private handleText(chunk: RenderChunk): void {
        this.clearLine();
        this.responseBuffer += chunk.content ?? '';
    }

    private handleThinking(_chunk: RenderChunk): void {
        this.clearLine();
        process.stdout.write(chalk.dim('  ⏳ Talon is thinking...'));
    }

    private handleError(chunk: RenderChunk): void {
        this.clearLine();

        // Show any tool results collected before the error
        if (this.toolResultsBuffer.length > 0) {
            this.printToolResults('Tool Results (before error)');
        }

        console.log(chalk.red('❌ Error: ') + (chunk.content ?? 'Unknown error'));
        this.finishResponse();
    }

    private handleToolCall(chunk: RenderChunk): void {
        this.clearLine();

        const toolName = chunk.toolCall?.name ?? 'tool';
        const toolArgs = chunk.toolCall?.args;
        let toolInfo = toolName;

        // Show contextual info for common arg patterns
        if (toolArgs?.path && typeof toolArgs.path === 'string') {
            const fileName = path.basename(toolArgs.path);
            toolInfo = `${toolName} → ${fileName}`;
        } else if (toolArgs?.url && typeof toolArgs.url === 'string') {
            toolInfo = `${toolName} → ${(toolArgs.url as string).substring(0, 40)}${(toolArgs.url as string).length > 40 ? '...' : ''}`;
        } else if (toolArgs?.query && typeof toolArgs.query === 'string') {
            toolInfo = `${toolName} → ${(toolArgs.query as string).substring(0, 30)}...`;
        }

        console.log(chalk.dim(`  🛠️  ${toolInfo}`));

        // Pre-register in results buffer for pairing with tool_result
        this.toolResultsBuffer.push({ name: toolName, output: '', success: true });
    }

    private handleToolResult(chunk: RenderChunk): void {
        if (!chunk.toolResult) return;

        // Find the first pending entry (empty output) and fill it
        const pending = this.toolResultsBuffer.find(tr => tr.output === '');
        if (pending) {
            pending.output = chunk.toolResult.output || '(no output)';
            pending.success = chunk.toolResult.success !== false;
        } else {
            // Fallback: add as new entry
            this.toolResultsBuffer.push({
                name: chunk.toolResult.id || 'tool',
                output: chunk.toolResult.output || '(no output)',
                success: chunk.toolResult.success !== false,
            });
        }
    }

    private handleDone(chunk: RenderChunk): void {
        this.clearLine();

        // Track model from done chunk
        if (chunk.model) {
            this.currentModel = chunk.model;
        }

        if (this.responseBuffer) {
            // LLM produced a response — show it
            this.printResponse(this.responseBuffer);
        } else if (this.toolResultsBuffer.length > 0) {
            // No LLM text, but we have tool results — show them as fallback
            this.printToolResults('Talon (Tool Results)');
        } else {
            // Nothing at all
            console.log(chalk.yellow('\n⚠ Talon completed but produced no output.'));
            console.log(chalk.dim('  The AI may have had trouble processing. Try rephrasing your request.'));
        }

        this.finishResponse();
    }

    // ─── Display Helpers ─────────────────────────────────────────

    /** Print a boxed response from the AI */
    private printResponse(text: string): void {
        const formatted = formatAIResponse(text);
        const modelName = this.currentModel.split('/').pop() || this.currentModel;

        console.log(chalk.gray('╭─ Talon ─────────────────────'));
        // Split by newlines and prefix each line
        for (const line of formatted.split('\n')) {
            console.log(chalk.gray('│ ') + line);
        }
        console.log(chalk.gray('│'));
        console.log(chalk.gray('│ ') + chalk.dim(`[${chalk.yellow(modelName)}]`));
        console.log(chalk.gray('╰─────────────────────────────'));
    }

    /** Print tool results in a boxed format */
    private printToolResults(title: string): void {
        console.log(chalk.gray(`╭─ ${title} ──────`));
        for (const tr of this.toolResultsBuffer) {
            const status = tr.success ? chalk.green('✓') : chalk.red('✗');
            const preview = tr.output.substring(0, 500);
            console.log(chalk.gray('│'));
            console.log(chalk.gray('│ ') + `${status} ${chalk.bold(tr.name)}:`);
            // Show output lines indented (max 10 lines)
            for (const line of preview.split('\n').slice(0, 10)) {
                console.log(chalk.gray('│   ') + line);
            }
            if (tr.output.length > 500 || tr.output.split('\n').length > 10) {
                console.log(chalk.gray('│   ') + chalk.dim('... (truncated)'));
            }
        }
        console.log(chalk.gray('╰─────────────────────────────'));
    }

    /** Clean up after a response cycle */
    private finishResponse(): void {
        this.responseBuffer = '';
        this.toolResultsBuffer = [];
        this.isWaiting = false;
        this.clearTimeout();
        console.log('');
        this.onPrompt();
    }

    /** Clear the current terminal line */
    private clearLine(): void {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    }

    // ─── Timeout ─────────────────────────────────────────────────

    private startTimeout(): void {
        this.clearTimeout();
        this.responseTimeout = setTimeout(() => {
            if (!this.isWaiting) return;

            this.clearLine();

            // Show any tool results we collected
            if (this.toolResultsBuffer.length > 0) {
                this.printToolResults('Talon (partial results)');
            }

            console.log(chalk.yellow('\n⚠ Response timed out. The AI provider may be slow or unresponsive.'));
            console.log(chalk.dim('  Try again, or check the gateway logs.\n'));
            this.responseBuffer = '';
            this.toolResultsBuffer = [];
            this.isWaiting = false;
            this.onPrompt();
        }, this.timeoutMs);
    }

    private clearTimeout(): void {
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
    }
}

// ─── Helpers for Converting Transport Messages ───────────────────

/**
 * Convert a WebSocket message from the gateway into a RenderChunk.
 * Used by the TUI client.
 */
export function wsMessageToChunk(msg: { type: string; payload?: any }): RenderChunk | null {
    switch (msg.type) {
        case 'agent.response': {
            const payload = msg.payload;
            if (payload?.type === 'text') {
                return { type: 'text', content: payload.content };
            } else if (payload?.type === 'thinking') {
                return { type: 'thinking', content: payload.content };
            } else if (payload?.type === 'error') {
                return { type: 'error', content: payload.content };
            }
            return null;
        }
        case 'agent.response.end':
            return {
                type: 'done',
                usage: msg.payload?.usage,
                providerId: msg.payload?.providerId,
                model: msg.payload?.model,
            };
        case 'tool.call':
            return {
                type: 'tool_call',
                toolCall: msg.payload?.toolCall,
            };
        case 'tool.result':
            return {
                type: 'tool_result',
                toolResult: msg.payload?.toolResult,
            };
        default:
            return null;
    }
}
