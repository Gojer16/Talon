// ─── CLI Commands ─────────────────────────────────────────────────
// Slash command system for Talon CLI
// Adapted from openclaw/src/tui/commands.ts

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Session } from '../../utils/types.js';
import { TALON_HOME } from '../../config/index.js';
import { formatAlignedColumns, formatSectionHeader, formatDivider } from './utils.js';

export type ParsedCommand = {
    name: string;
    args: string;
};

export type CommandCategory = 'Session' | 'System' | 'Tools' | 'Shortcuts' | 'Skills';

export interface SlashCommand {
    name: string;
    description: string;
    category: CommandCategory;
    handler: (args: string, session: Session, context?: CommandContext) => Promise<CommandResult> | CommandResult;
}

export interface CommandContext {
    config?: TalonConfigSummary;
    logLevel?: string;
    setLogLevel?: (level: string) => void;
}

export interface TalonConfigSummary {
    workspace: string;
    model: string;
    providers: string[];
    channels: {
        cli: boolean;
        telegram: boolean;
        whatsapp: boolean;
        webchat: boolean;
    };
    gateway: {
        host: string;
        port: number;
    };
}

export interface CommandResult {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    shouldContinue?: boolean;
    shouldClear?: boolean;
}

// ─── Command Parser ───────────────────────────────────────────────

export function parseCommand(input: string): ParsedCommand {
    const trimmed = input.replace(/^\//, '').trim();
    if (!trimmed) {
        return { name: '', args: '' };
    }
    const [name, ...rest] = trimmed.split(/\s+/);
    return {
        name: name.toLowerCase(),
        args: rest.join(' ').trim(),
    };
}

// ─── Command Registry ─────────────────────────────────────────────

import { skillCommandRegistry, type SkillCommand } from './skill-commands.js';

export class CommandRegistry {
    private commands = new Map<string, SlashCommand>();

    register(command: SlashCommand): void {
        this.commands.set(command.name, command);
    }

    get(name: string): SlashCommand | undefined {
        const normalizedName = name.toLowerCase();

        // First check built-in commands
        const builtin = this.commands.get(normalizedName);
        if (builtin) return builtin;

        // Then check skill commands
        const skillCmd = skillCommandRegistry.get(normalizedName);
        if (skillCmd) {
            // Convert SkillCommand to SlashCommand for compatibility
            return {
                name: skillCmd.name,
                description: skillCmd.description,
                category: 'Skills',
                handler: skillCmd.handler,
            };
        }

        return undefined;
    }

    list(): SlashCommand[] {
        const builtin = Array.from(this.commands.values());
        const skill = skillCommandRegistry.list().map(skillCmd => ({
            name: skillCmd.name,
            description: skillCmd.description,
            category: 'Skills' as CommandCategory,
            handler: skillCmd.handler,
        }));

        return [...builtin, ...skill];
    }

    listBuiltin(): SlashCommand[] {
        return Array.from(this.commands.values());
    }

    listSkill(): SlashCommand[] {
        return skillCommandRegistry.list().map(skillCmd => ({
            name: skillCmd.name,
            description: skillCmd.description,
            category: 'Skills' as CommandCategory,
            handler: skillCmd.handler,
        }));
    }

    listByCategory(category: CommandCategory): SlashCommand[] {
        return this.list().filter(cmd => cmd.category === category);
    }

    getHelpText(): string {
        const categories: CommandCategory[] = ['Session', 'System', 'Tools', 'Shortcuts', 'Skills'];
        const lines: string[] = [
            '🦅 Talon CLI Commands',
            formatDivider(50),
        ];

        for (const category of categories) {
            const commands = category === 'Skills' 
                ? this.listSkill()
                : this.listBuiltin().filter(cmd => cmd.category === category);

            if (commands.length > 0) {
                lines.push(formatSectionHeader(category));
                
                const items: Array<[string, string]> = commands.map(cmd => [cmd.name, cmd.description]);
                lines.push(formatAlignedColumns(items));
                lines.push('');
            }
        }

        // Other shortcuts
        lines.push(formatSectionHeader('Shell'));
        lines.push(formatAlignedColumns([['!<command>', 'Execute bash command (e.g., !ls, !pwd)']]));

        return lines.join('\n');
    }

    getCommandSuggestions(input: string, maxSuggestions: number = 3): string[] {
        const allCommands = this.list().map(cmd => cmd.name);
        const inputLower = input.toLowerCase();

        // Calculate similarity scores
        const scored = allCommands.map(name => {
            const nameLower = name.toLowerCase();
            
            // Exact substring match gets high priority
            if (nameLower.includes(inputLower)) {
                return { name, score: 0.9 + (nameLower === inputLower ? 0.1 : 0) };
            }
            
            // Prefix match
            if (nameLower.startsWith(inputLower)) {
                return { name, score: 0.8 };
            }
            
            // Levenshtein distance for typos
            const { stringSimilarity } = require('./utils.js');
            const similarity = stringSimilarity(inputLower, nameLower);
            return { name, score: similarity };
        });

        // Filter by minimum similarity threshold and sort
        return scored
            .filter(item => item.score > 0.4) // Minimum threshold
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSuggestions)
            .map(item => item.name);
    }
}

// ─── Built-in Commands ────────────────────────────────────────────

export function createBuiltinCommands(): CommandRegistry {
    const registry = new CommandRegistry();

    // Help command
    registry.register({
        name: 'help',
        description: 'Show available commands',
        category: 'Session',
        handler: (_args, _session) => ({
            type: 'info',
            message: registry.getHelpText(),
        }),
    });

    // Status command
    registry.register({
        name: 'status',
        description: 'Show session status and token usage',
        category: 'Session',
        handler: (_args, session) => {
            const msgCount = session.messages.length;
            const summaryTokens = session.memorySummary 
                ? Math.ceil(session.memorySummary.length / 4)
                : 0;
            
            return {
                type: 'info',
                message: [
                    '🦅 Session Status',
                    '─────────────────',
                    `  Session ID:    ${session.id}`,
                    `  Messages:      ${msgCount}`,
                    `  Memory Summary: ~${summaryTokens} tokens`,
                    `  State:         ${session.state}`,
                ].join('\n'),
            };
        },
    });

    // Reset command
    registry.register({
        name: 'reset',
        description: 'Reset the current session (clear history)',
        category: 'Session',
        handler: (_args, session) => {
            session.messages = [];
            session.memorySummary = '';
            return {
                type: 'success',
                message: 'Session reset. History cleared.',
            };
        },
    });

    registry.register({
        name: 'new',
        description: 'Alias for /reset',
        category: 'Session',
        handler: (_args, session) => {
            session.messages = [];
            session.memorySummary = '';
            return {
                type: 'success',
                message: 'Session reset. History cleared.',
            };
        },
    });

    // Model command
    registry.register({
        name: 'model',
        description: 'Show current model',
        category: 'System',
        handler: (_args, _session, context) => {
            if (!context?.config) {
                return {
                    type: 'info',
                    message: '⚙️  Model information not available',
                };
            }

            const { model, providers } = context.config;
            const activeProviders = providers.join(', ');

            return {
                type: 'info',
                message: `🤖 Current Model\n  Model:     ${model}\n  Providers: ${activeProviders}`,
            };
        },
    });

    // Compact command
    registry.register({
        name: 'compact',
        description: 'Force memory compression',
        category: 'Session',
        handler: (_args, session) => {
            // Mark for compression - actual compression happens in agent loop
            return {
                type: 'success',
                message: `Session has ${session.messages.length} messages. Compression will run on next iteration.`,
            };
        },
    });

    // Exit command
    registry.register({
        name: 'exit',
        description: 'Exit Talon',
        category: 'System',
        handler: () => ({
            type: 'success',
            message: 'Goodbye!',
            shouldContinue: false,
        }),
    });

    registry.register({
        name: 'quit',
        description: 'Alias for /exit',
        category: 'System',
        handler: () => ({
            type: 'success',
            message: 'Goodbye!',
            shouldContinue: false,
        }),
    });

    // Token usage command
    registry.register({
        name: 'tokens',
        description: 'Show estimated token usage',
        category: 'Session',
        handler: (_args, session) => {
            const totalChars = session.messages.reduce((sum: number, m: typeof session.messages[0]) => sum + m.content.length, 0);
            const estimatedTokens = Math.ceil(totalChars / 4);
            const summaryTokens = session.memorySummary 
                ? Math.ceil(session.memorySummary.length / 4)
                : 0;
            
            return {
                type: 'info',
                message: [
                    '💰 Token Usage Estimate',
                    '───────────────────────',
                    `  Messages:       ~${estimatedTokens.toLocaleString()} tokens`,
                    `  Memory Summary: ~${summaryTokens.toLocaleString()} tokens`,
                    `  Total:          ~${(estimatedTokens + summaryTokens).toLocaleString()} tokens`,
                    '',
                    'Note: These are estimates (~4 chars/token).',
                    'Actual usage shown in API responses.',
                ].join('\n'),
            };
        },
    });

    // ── Config command ─────────────────────────────────────────────
    registry.register({
        name: 'config',
        description: 'View current Talon configuration',
        category: 'System',
        handler: (_args, _session, context) => {
            const config = context?.config ?? getDefaultConfig();
            
            return {
                type: 'info',
                message: [
                    '⚙️  Talon Configuration',
                    '────────────────────────',
                    `  Workspace:   ${config.workspace}`,
                    `  Model:       ${config.model}`,
                    `  Gateway:     ${config.gateway.host}:${config.gateway.port}`,
                    '',
                    '  Channels:',
                    `    CLI:       ${config.channels.cli ? '✅' : '❌'}`,
                    `    Telegram:  ${config.channels.telegram ? '✅' : '❌'}`,
                    `    WhatsApp:  ${config.channels.whatsapp ? '✅' : '❌'}`,
                    `    WebChat:   ${config.channels.webchat ? '✅' : '❌'}`,
                    '',
                    `  Providers:  ${config.providers.join(', ')}`,
                ].join('\n'),
            };
        },
    });

    // ── Memory command ─────────────────────────────────────────────
    registry.register({
        name: 'memory',
        description: 'View recent memory entries',
        category: 'System',
        handler: (_args, _session, _context) => {
            const memoryDir = path.join(TALON_HOME, 'workspace');
            const memoryFiles = [
                'MEMORY.md',
                'SOUL.md', 
                'USER.md',
                'IDENTITY.md',
                'FACTS.json',
            ];
            
            const entries: string[] = [];
            
            for (const file of memoryFiles) {
                const filePath = path.join(memoryDir, file);
                if (fs.existsSync(filePath)) {
                    const stat = fs.statSync(filePath);
                    const date = stat.mtime.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                    entries.push(`  • ${file} (${date})`);
                }
            }
            
            if (entries.length === 0) {
                return {
                    type: 'info',
                    message: '📝 Memory\n\nNo memory files found.',
                };
            }
            
            return {
                type: 'info',
                message: [
                    '📝 Memory Files',
                    '────────────────',
                    ...entries,
                    '',
                    'Use /reset to clear session history.',
                ].join('\n'),
            };
        },
    });

    // ── Clear command ─────────────────────────────────────────────
    registry.register({
        name: 'clear',
        description: 'Clear screen (keep history)',
        category: 'Tools',
        handler: () => {
            return {
                type: 'success',
                message: '',
                shouldClear: true,
            };
        },
    });

    // ── Version command ────────────────────────────────────────────
    registry.register({
        name: 'version',
        description: 'Show Talon version and info',
        category: 'System',
        handler: () => {
            const packageJson = getPackageInfo();
            const uptime = process.uptime();
            const uptimeStr = formatUptime(uptime);
            
            return {
                type: 'info',
                message: [
                    '🦅 Talon',
                    '────────',
                    `  Version:   ${packageJson.version}`,
                    `  Name:      ${packageJson.name}`,
                    `  Node:      ${process.version}`,
                    `  Platform:  ${os.platform()} ${os.arch()}`,
                    `  Uptime:    ${uptimeStr}`,
                    '',
                    packageJson.description,
                ].join('\n'),
            };
        },
    });

    // ── Debug command ─────────────────────────────────────────────
    registry.register({
        name: 'debug',
        description: 'Toggle debug logging',
        category: 'System',
        handler: async (_args, _session, context) => {
            const currentLevel = context?.logLevel ?? 'info';
            const newLevel = currentLevel === 'debug' ? 'info' : 'debug';
            
            if (context?.setLogLevel) {
                await context.setLogLevel(newLevel);
            }
            
            return {
                type: 'success',
                message: `Debug mode ${newLevel === 'debug' ? 'enabled' : 'disabled'}. Current: ${newLevel}`,
            };
        },
    });

    return registry;
}

// ─── Bash Command Handler ─────────────────────────────────────────

export function isBangLine(input: string): boolean {
    return input.startsWith('!') && input !== '!';
}

export function parseBangLine(input: string): string {
    return input.slice(1).trim(); // Remove the '!' prefix
}

// ─── Helper Functions ─────────────────────────────────────────────

interface PackageJson {
    name: string;
    version: string;
    description: string;
}

function getPackageInfo(): PackageJson {
    try {
        const packagePath = path.join(TALON_HOME, '..', 'package.json');
        const content = fs.readFileSync(packagePath, 'utf-8');
        return JSON.parse(content) as PackageJson;
    } catch {
        return {
            name: 'talon',
            version: '0.3.0',
            description: 'Personal AI Assistant',
        };
    }
}

function getDefaultConfig(): TalonConfigSummary {
    return {
        workspace: path.join(os.homedir(), '.talon', 'workspace'),
        model: 'deepseek/deepseek-chat',
        providers: ['deepseek'],
        channels: {
            cli: true,
            telegram: false,
            whatsapp: false,
            webchat: true,
        },
        gateway: {
            host: '127.0.0.1',
            port: 19789,
        },
    };
}

function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}
