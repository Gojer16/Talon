// ─── Memory Tools ─────────────────────────────────────────────────
// Tools for the agent to manage its own memory files (MEMORY.md, SOUL.md)
// Includes both simple file operations and semantic search

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TalonConfig } from '../config/schema.js';
import type { ToolDefinition } from './registry.js';
import { logger } from '../utils/logger.js';

function getWorkspacePath(config: TalonConfig, file: string): string {
    return path.join(
        config.workspace.root.replace(/^~/, os.homedir()),
        file,
    );
}

function getMemoryDir(config: TalonConfig): string {
    return path.join(
        config.workspace.root.replace(/^~/, os.homedir()),
        'memory',
    );
}

// Simple text-based search in memory files
async function searchMemoryFiles(query: string, config: TalonConfig, maxResults: number = 5): Promise<string[]> {
    const results: string[] = [];
    const workspaceRoot = config.workspace.root.replace(/^~/, os.homedir());
    const searchRegex = new RegExp(query, 'i');

    const filesToSearch = [
        getWorkspacePath(config, 'MEMORY.md'),
        getWorkspacePath(config, 'SOUL.md'),
        getWorkspacePath(config, 'USER.md'),
        getWorkspacePath(config, 'IDENTITY.md'),
    ];

    const memoryDir = getMemoryDir(config);
    if (fs.existsSync(memoryDir)) {
        const memoryFiles = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
        for (const f of memoryFiles) {
            filesToSearch.push(path.join(memoryDir, f));
        }
    }

    for (const filePath of filesToSearch) {
        if (!fs.existsSync(filePath)) continue;

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (searchRegex.test(lines[i])) {
                    const relativePath = path.relative(workspaceRoot, filePath);
                    results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);

                    if (results.length >= maxResults * 3) break;
                }
            }
        } catch {
            // Skip files we can't read
        }

        if (results.length >= maxResults * 3) break;
    }

    return results.slice(0, maxResults);
}

export function registerMemoryTools(config: TalonConfig): ToolDefinition[] {
    return [
        // ── memory_append ────────────────────────────────────
        {
            name: 'memory_append',
            description: 'Append a new entry to your long-term memory (MEMORY.md). Use this to store important facts, preferences, or decisions that you should remember across sessions.',
            parameters: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'The text to append to memory. Be concise.',
                    },
                    category: {
                        type: 'string',
                        description: 'Optional category (e.g., "Fact", "Decision", "Preference"). Default: "Note"',
                    },
                },
                required: ['text'],
            },
            execute: async (args) => {
                const text = args.text as string;
                const category = (args.category as string) || 'Note';
                const memoryPath = getWorkspacePath(config, 'MEMORY.md');

                if (!fs.existsSync(memoryPath)) {
                    fs.writeFileSync(memoryPath, '# MEMORY\n\nYour long-term memory.\n\n## Entries\n\n');
                }

                const timestamp = new Date().toISOString().split('T')[0];
                const entry = `\n- **${timestamp}** [${category}] ${text}`;

                fs.appendFileSync(memoryPath, entry, 'utf-8');
                logger.info({ category, length: text.length }, 'Appended to MEMORY.md');

                return `Added to long-term memory:\n${entry.trim()}`;
            },
        },

        // ── memory_read ──────────────────────────────────────
        {
            name: 'memory_read',
            description: 'Read your long-term memory (MEMORY.md). Useful for recalling past decisions or facts.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Optional: path relative to workspace (e.g., "memory/todos.md"). Default: MEMORY.md',
                    },
                },
            },
            execute: async (args) => {
                const relPath = args.path as string | undefined;
                const memoryPath = relPath
                    ? path.join(config.workspace.root.replace(/^~/, os.homedir()), relPath)
                    : getWorkspacePath(config, 'MEMORY.md');

                if (!fs.existsSync(memoryPath)) {
                    return 'Memory file is empty or does not exist.';
                }
                const content = fs.readFileSync(memoryPath, 'utf-8');
                return content;
            },
        },

        // ── memory_search ────────────────────────────────────
        {
            name: 'memory_search',
            description: 'Search your long-term memory for relevant information. Searches MEMORY.md, SOUL.md, USER.md, and memory/*.md files. Returns matching lines with context.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query - keywords or phrases to find',
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of results. Default: 5',
                    },
                },
                required: ['query'],
            },
            execute: async (args) => {
                const query = args.query as string;
                const maxResults = (args.maxResults as number) || 5;

                logger.info({ query, maxResults }, 'memory_search');

                const results = await searchMemoryFiles(query, config, maxResults);

                if (results.length === 0) {
                    return `No matches found for "${query}" in memory files.`;
                }

                return `**Memory Search Results for "${query}"**\n\n${results.join('\n')}`;
            },
        },

        // ── soul_update ──────────────────────────────────────
        {
            name: 'soul_update',
            description: 'Update your SOUL.md file. Use this very carefully to evolve your personality or instructions based on user feedback.',
            parameters: {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'The new full content for SOUL.md.',
                    },
                },
                required: ['content'],
            },
            execute: async (args) => {
                const content = args.content as string;
                const soulPath = getWorkspacePath(config, 'SOUL.md');

                if (fs.existsSync(soulPath)) {
                    const backupPath = `${soulPath}.bak`;
                    fs.copyFileSync(soulPath, backupPath);
                }

                fs.writeFileSync(soulPath, content, 'utf-8');
                logger.warn('SOUL.md updated by agent');

                return 'SOUL.md updated successfully. I will read this new identity on the next turn.';
            },
        },

        // ── facts_update ─────────────────────────────────────
        {
            name: 'facts_update',
            description: 'Update facts about the user in FACTS.json. Use this to store important user preferences, details, or knowledge.',
            parameters: {
                type: 'object',
                properties: {
                    facts: {
                        type: 'string',
                        description: 'JSON string of facts to store (must be a valid JSON object)',
                    },
                },
                required: ['facts'],
            },
            execute: async (args) => {
                const factsStr = args.facts as string;
                let facts: Record<string, unknown>;

                try {
                    facts = JSON.parse(factsStr);
                } catch {
                    return 'Error: facts must be a valid JSON string.';
                }

                const factsPath = getWorkspacePath(config, 'FACTS.json');
                const dir = path.dirname(factsPath);

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                let existingFacts: Record<string, unknown> = {};
                if (fs.existsSync(factsPath)) {
                    try {
                        existingFacts = JSON.parse(fs.readFileSync(factsPath, 'utf-8'));
                    } catch {
                        // Start fresh if corrupted
                    }
                }

                const merged = { ...existingFacts, ...facts };
                fs.writeFileSync(factsPath, JSON.stringify(merged, null, 2), 'utf-8');
                logger.info({ facts: Object.keys(facts) }, 'facts_update');

                return `Updated facts:\n${JSON.stringify(facts, null, 2)}`;
            },
        },
    ];
}
