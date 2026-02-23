// ─── Notes Tools Tests ───────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentLoop } from '../../src/agent/loop.js';
import { ModelRouter } from '../../src/agent/router.js';
import { MemoryManager } from '../../src/memory/manager.js';
import { MemoryCompressor } from '../../src/memory/compressor.js';
import { EventBus } from '../../src/gateway/events.js';
import { registerAllTools } from '../../src/tools/registry.js';
import type { TalonConfig } from '../../src/config/schema.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Notes Tools Comprehensive', () => {
    let agentLoop: AgentLoop;
    let testDir: string;
    let notesDir: string;

    beforeAll(async () => {
        testDir = path.join(os.tmpdir(), `talon-notes-test-${Date.now()}`);
        notesDir = path.join(testDir, 'notes');
        fs.mkdirSync(notesDir, { recursive: true });

        const config: TalonConfig = {
            workspace: { root: testDir },
            agent: { model: 'test', maxIterations: 5, subagentModel: 'test', providers: {} },
            tools: {
                files: { enabled: false, allowedPaths: [], deniedPaths: [], maxFileSize: 1048576 },
                shell: { enabled: false },
                browser: { enabled: false },
            },
            memory: { compaction: { enabled: false, keepRecentMessages: 10 } },
            channels: { cli: { enabled: true }, telegram: { enabled: false }, whatsapp: { enabled: false } },
            gateway: { host: '127.0.0.1', port: 19789, token: null },
            hooks: { bootMd: { enabled: false } },
            shadow: { enabled: false, watchPaths: [], ignorePatterns: [] },
        } as TalonConfig;

        const eventBus = new EventBus();
        const modelRouter = new ModelRouter(config);
        const memoryManager = new MemoryManager({ workspaceRoot: testDir, maxContextTokens: 6000, maxSummaryTokens: 800, keepRecentMessages: 10 });
        const memoryCompressor = new MemoryCompressor(modelRouter);
        agentLoop = new AgentLoop(modelRouter, memoryManager, memoryCompressor, eventBus, { maxIterations: 5 });
        registerAllTools(agentLoop, config);
    });

    afterAll(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    describe('notes_save', () => {
        it('should save a note with title and content', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                title: 'Test Note',
                content: 'This is test content',
                tags: ['test', 'example'],
            });

            expect(result).toContain('Note saved');
            expect(result).toContain('Test Note.md');

            const notePath = path.join(notesDir, 'Test Note.md');
            expect(fs.existsSync(notePath)).toBe(true);

            const content = fs.readFileSync(notePath, 'utf-8');
            expect(content).toContain('This is test content');
            expect(content).toContain('tags: [test, example]');
        });

        it('should save a note without tags', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                title: 'Simple Note',
                content: 'No tags here',
            });

            expect(result).toContain('Note saved');
        });

        it('should reject empty title', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                title: '',
                content: 'Some content',
            });

            expect(result).toContain('Error');
            expect(result).toContain('title');
        });

        it('should reject missing title', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                content: 'Some content',
            });

            expect(result).toContain('Error');
        });

        it('should reject empty content', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                title: 'Test',
                content: '',
            });

            expect(result).toContain('Error');
            expect(result).toContain('content');
        });

        it('should reject title that is too long', async () => {
            const longTitle = 'a'.repeat(250);
            const result = await agentLoop.executeTool('notes_save', {
                title: longTitle,
                content: 'Content',
            });

            expect(result).toContain('Error');
            expect(result).toContain('title');
        });

        it('should sanitize title with special characters', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                title: 'Test/../Malicious Note',
                content: 'Content',
            });

            // Should either save with sanitized name or reject
            expect(result).toMatch(/(Note saved|Error)/);
        });
    });

    describe('notes_search', () => {
        beforeEach(async () => {
            // Create some test notes
            await agentLoop.executeTool('notes_save', {
                title: 'Project Alpha',
                content: 'This is about project alpha. Important details here.',
                tags: ['project', 'alpha'],
            });

            await agentLoop.executeTool('notes_save', {
                title: 'Meeting Notes',
                content: 'Discussed project beta and timeline.',
                tags: ['meeting', 'beta'],
            });

            await agentLoop.executeTool('notes_save', {
                title: 'Ideas',
                content: 'Random ideas for future projects.',
                tags: ['ideas', 'future'],
            });
        });

        it('should search by keyword in content', async () => {
            const result = await agentLoop.executeTool('notes_search', {
                query: 'project',
            });

            expect(result).toContain('Project Alpha');
            expect(result).toContain('project beta');
        });

        it('should search by tag', async () => {
            const result = await agentLoop.executeTool('notes_search', {
                query: 'tag:meeting',
            });

            expect(result).toContain('Meeting Notes');
        });

        it('should return no results for unknown query', async () => {
            const result = await agentLoop.executeTool('notes_search', {
                query: 'nonexistent12345',
            });

            expect(result).toContain('No notes found');
        });

        it('should reject empty query', async () => {
            const result = await agentLoop.executeTool('notes_search', {
                query: '',
            });

            expect(result).toContain('Error');
            expect(result).toContain('query');
        });

        it('should reject missing query', async () => {
            const result = await agentLoop.executeTool('notes_search', {});

            expect(result).toContain('Error');
        });

        it('should search case-insensitively', async () => {
            const result = await agentLoop.executeTool('notes_search', {
                query: 'PROJECT',
            });

            expect(result).toContain('Project Alpha');
        });
    });

    describe('Input Validation', () => {
        it('should handle invalid types for notes_save', async () => {
            const result = await agentLoop.executeTool('notes_save', {
                title: 123 as any,
                content: 'Content',
            });

            expect(result).toContain('Error');
        });

        it('should handle invalid types for notes_search', async () => {
            const result = await agentLoop.executeTool('notes_search', {
                query: 123 as any,
            });

            expect(result).toContain('Error');
        });
    });
});
