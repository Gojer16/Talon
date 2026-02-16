// ─── CLI Channel ──────────────────────────────────────────────────
// Interactive REPL for talking to the agent directly from the terminal.

import readline from 'node:readline';
import { BaseChannel } from '../base.js';
import type { OutboundMessage } from '../../utils/types.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';

export class CliChannel extends BaseChannel {
    public readonly name = 'cli';
    private rl: readline.Interface | null = null;
    private sessionId: string | null = null;
    private isShutdown = false;
    private isStarted = false;

    public async start(): Promise<void> {
        if (this.isStarted) {
            logger.warn('CLI channel already started, ignoring duplicate start() call');
            return;
        }

        if (!this.config.channels.cli.enabled) {
            return;
        }

        // Only start CLI if we are in a TTY environment
        if (!process.stdin.isTTY) {
            logger.info('Not running in TTY, CLI channel disabled');
            return;
        }

        this.isStarted = true;
        logger.info('Starting CLI channel...');

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('You > '),
        });

        // Print Welcome Banner
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        console.clear();
        console.log('');
        console.log(chalk.bold.hex('#FF4500')('  Hello! Good morning! 🦅'));
        console.log('');


        // Create or resume a session for the CLI user
        // We use a fixed session ID so history persists across restarts
        const cliSessionId = 'cli-local';
        let session = this.sessionManager.getSession(cliSessionId);

        if (!session) {
            try {
                // Try dealing with resume from disk
                session = this.sessionManager.resumeSession(cliSessionId);
            } catch {
                // Not found on disk, create new with explicit ID
                // We assume SessionManager has been updated to accept explicitId as 4th arg
                session = this.sessionManager.createSession('user', 'cli', 'User', cliSessionId);
            }
        }
        this.sessionId = session.id;

        // Listen for outbound messages from the agent
        // Use a unique listener ID to prevent duplicate registration
        const outboundListener = (params: { sessionId: string; message: OutboundMessage }) => {
            if (params.sessionId === this.sessionId) {
                logger.info({ 
                    sessionId: this.sessionId,
                    textPreview: params.message.text.substring(0, 50)
                }, 'CLI received message.outbound event - PRINTING RESPONSE');
                this.printResponse(params.message);
            }
        };
        this.eventBus.on('message.outbound', outboundListener);

        this.eventBus.on('tool.execute', (params) => {
            if (params.sessionId === this.sessionId) {
                // Clear current line and move cursor up to avoid interfering with prompt
                process.stdout.write('\r\x1b[K');
                console.log(chalk.gray(`🛠️  Using tool: ${params.tool}`));
                this.prompt();
            }
        });

        this.eventBus.on('agent.thinking', (params) => {
            if (params.sessionId === this.sessionId) {
                // simple visual cue
            }
        });

        // Start the input loop
        this.prompt();

        // ─── Startup Logic (Bootstrap + Smart Resume) ───

        const workspaceRoot = this.config.workspace.root.replace(/^~/, process.env.HOME || '');
        // Dynamic imports for filesystem access
        const fs = await import('node:fs');
        const path = await import('node:path');
        const bootstrapFile = path.join(workspaceRoot, 'BOOTSTRAP.md');
        const isBootstrap = fs.existsSync(bootstrapFile);

        if (isBootstrap && session.messages.length === 0) {
            // Case 1: First Run (Bootstrap)
            // Agent needs to wake up and ask questions.
            console.log(chalk.gray('  First run detected - initializing...'));
            await this.ingestMessage('user', 'User', 'Hello');
        } else if (session.messages.length === 0) {
            // Case 2: Fresh session (no bootstrap, no history)
            // Just show the prompt, don't send anything until user types
            // No auto-message - wait for user input
        } else {
            // Case 3: Resumed session with history
            // The user wants a proactive "Here is the plan" message on startup.

            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const timeStr = new Date().toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit' });

            const prompt = `[SYSTEM EVENT: CLI CONNECTED]\nTime: ${timeStr} (${timeZone})\nTask: Greet the user, summarize active tasks from MEMORY.md if any, and suggest next steps. Be concise and proactive.`;

            // Clear line before showing status
            process.stdout.write('\r\x1b[K');
            console.log(chalk.gray('  reading memory...'));

            // We send as 'user' so it routes to the same cli-local session
            await this.ingestMessage('user', 'User', prompt);
        }

        this.rl.on('line', async (line) => {
            const text = line.trim();
            if (!text) {
                this.prompt();
                return;
            }

            if (text.toLowerCase() === '/exit' || text.toLowerCase() === '/quit') {
                console.log('Goodbye!');
                process.exit(0);
            }

            await this.ingestMessage('user', 'User', text);
        });

        this.rl.on('close', () => {
            if (!this.isShutdown) {
                console.log('CLI closed.');
                process.exit(0);
            }
        });
    }

    public async stop(): Promise<void> {
        this.isShutdown = true;
        this.isStarted = false;
        this.rl?.close();
        this.rl = null;
    }

    public async send(sessionId: string, message: OutboundMessage): Promise<void> {
        // Handled by event listener
    }

    private printResponse(message: OutboundMessage): void {
        logger.info({ textPreview: message.text.substring(0, 50) }, 'printResponse called');
        const prefix = chalk.green('🦅 Talon > ');
        const cleanText = this.stripMarkdown(message.text);
        console.log('');
        console.log(prefix + cleanText);
        console.log('');
        this.prompt();
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^\s*[-*+]\s+/gm, chalk.dim('  - '))
            .replace(/^\s*\d+\.\s+/gm, '  ')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/---+/g, chalk.dim('---'))
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    private prompt(): void {
        if (this.rl && !this.isShutdown) {
            this.rl.prompt();
        }
    }
}
