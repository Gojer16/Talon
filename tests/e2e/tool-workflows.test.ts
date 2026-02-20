import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentLoop } from '../../src/agent/loop.js';
import { ModelRouter } from '../../src/agent/router.js';
import { MemoryManager } from '../../src/memory/manager.js';
import { MemoryCompressor } from '../../src/memory/compressor.js';
import { EventBus } from '../../src/gateway/events.js';
import { registerAllTools } from '../../src/tools/registry.js';
import type { TalonConfig } from '../../src/config/schema.js';
import type { NormalizedToolResult } from '../../src/tools/normalize.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('End-to-End Tool Execution', () => {
    let agentLoop: AgentLoop;
    let testDir: string;

    beforeAll(async () => {
        testDir = path.join(os.tmpdir(), `talon-e2e-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });

        const config: TalonConfig = {
            workspace: { root: testDir },
            agent: { 
                model: 'test', 
                maxIterations: 10, 
                subagentModel: 'test',
                providers: {}
            },
            tools: {
                files: {
                    enabled: true,
                    allowedPaths: [testDir, os.homedir()],
                    deniedPaths: [],
                    maxFileSize: 10485760,
                },
                shell: {
                    enabled: true,
                    defaultTimeout: 10000,
                    maxOutputSize: 100000,
                    blockedCommands: ['rm -rf /', 'sudo rm', 'dd if='],
                    confirmDestructive: true,
                },
                browser: { enabled: false },
            },
            memory: { compaction: { enabled: false, keepRecentMessages: 20 } },
            channels: { cli: { enabled: true }, telegram: { enabled: false }, whatsapp: { enabled: false } },
            gateway: { host: '127.0.0.1', port: 19789, token: null },
            hooks: { bootMd: { enabled: false } },
            shadow: { enabled: false, watchPaths: [], ignorePatterns: [] },
        } as TalonConfig;

        const eventBus = new EventBus();
        const modelRouter = new ModelRouter(config);
        const memoryManager = new MemoryManager({
            workspaceRoot: testDir,
            maxContextTokens: 8000,
            maxSummaryTokens: 1000,
            keepRecentMessages: 20,
        });
        const memoryCompressor = new MemoryCompressor(modelRouter);

        agentLoop = new AgentLoop(modelRouter, memoryManager, memoryCompressor, eventBus, { maxIterations: 10 });
        registerAllTools(agentLoop, config);
    });

    afterAll(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Multi-Step File Operations', () => {
        it('should create, read, modify, and delete a file', async () => {
            const testFile = path.join(testDir, 'multi-step.txt');

            // Step 1: Write
            const writeResult = await agentLoop.executeTool('file_write', {
                path: testFile,
                content: 'Initial content',
            });
            let parsed: NormalizedToolResult = JSON.parse(writeResult);
            expect(parsed.success).toBe(true);

            // Step 2: Read
            const readResult = await agentLoop.executeTool('file_read', {
                path: testFile,
            });
            parsed = JSON.parse(readResult);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('Initial content');

            // Step 3: Modify
            const modifyResult = await agentLoop.executeTool('file_write', {
                path: testFile,
                content: 'Modified content',
            });
            parsed = JSON.parse(modifyResult);
            expect(parsed.success).toBe(true);

            // Step 4: Verify modification
            const verifyResult = await agentLoop.executeTool('file_read', {
                path: testFile,
            });
            parsed = JSON.parse(verifyResult);
            expect(parsed.data).toContain('Modified content');
            expect(parsed.data).not.toContain('Initial content');

            // Cleanup
            fs.unlinkSync(testFile);
        });

        it('should handle directory listing and file search', async () => {
            // Create test files
            fs.writeFileSync(path.join(testDir, 'test1.txt'), 'Hello World');
            fs.writeFileSync(path.join(testDir, 'test2.txt'), 'Goodbye World');
            fs.writeFileSync(path.join(testDir, 'test3.md'), '# Markdown');

            // List directory
            const listResult = await agentLoop.executeTool('file_list', {
                path: testDir,
            });
            let parsed: NormalizedToolResult = JSON.parse(listResult);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('test1.txt');
            expect(parsed.data).toContain('test2.txt');
            expect(parsed.data).toContain('test3.md');

            // Search for pattern
            const searchResult = await agentLoop.executeTool('file_search', {
                path: testDir,
                pattern: 'World',
            });
            parsed = JSON.parse(searchResult);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('test1.txt');
            expect(parsed.data).toContain('test2.txt');
        });
    });

    describe('Shell Command Workflows', () => {
        it('should execute multiple shell commands in sequence', async () => {
            // Create directory
            const result1 = await agentLoop.executeTool('shell_execute', {
                command: 'mkdir -p test-shell-dir',
                cwd: testDir,
            });
            let parsed: NormalizedToolResult = JSON.parse(result1);
            expect(parsed.success).toBe(true);

            // Create file in directory
            const result2 = await agentLoop.executeTool('shell_execute', {
                command: 'echo "test content" > test-shell-dir/file.txt',
                cwd: testDir,
            });
            parsed = JSON.parse(result2);
            expect(parsed.success).toBe(true);

            // List directory
            const result3 = await agentLoop.executeTool('shell_execute', {
                command: 'ls test-shell-dir',
                cwd: testDir,
            });
            parsed = JSON.parse(result3);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('file.txt');

            // Read file
            const result4 = await agentLoop.executeTool('shell_execute', {
                command: 'cat test-shell-dir/file.txt',
                cwd: testDir,
            });
            parsed = JSON.parse(result4);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('test content');
        });

        it('should handle command failures gracefully', async () => {
            const result = await agentLoop.executeTool('shell_execute', {
                command: 'cat /nonexistent/file/path.txt',
                cwd: testDir,
            });
            const parsed: NormalizedToolResult = JSON.parse(result);

            // Should still return valid JSON even on failure
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('meta');
            expect(parsed.meta.duration_ms).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Memory and Notes Workflow', () => {
        it('should save notes and search them', async () => {
            // Save multiple notes
            await agentLoop.executeTool('notes_save', {
                title: 'Project Ideas',
                content: 'Build a todo app',
                tags: ['project', 'ideas'],
            });

            await agentLoop.executeTool('notes_save', {
                title: 'Meeting Notes',
                content: 'Discussed project timeline',
                tags: ['meeting', 'project'],
            });

            await agentLoop.executeTool('notes_save', {
                title: 'Random Thoughts',
                content: 'Need to buy groceries',
                tags: ['personal'],
            });

            // Search by keyword
            const searchResult = await agentLoop.executeTool('notes_search', {
                query: 'project',
            });
            const parsed: NormalizedToolResult = JSON.parse(searchResult);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('Project Ideas');
            expect(parsed.data).toContain('Meeting Notes');
            expect(parsed.data).not.toContain('Random Thoughts');
        });

        it('should manage task lifecycle', async () => {
            // Add tasks
            const add1 = await agentLoop.executeTool('tasks_add', {
                title: 'Write tests',
                description: 'Add comprehensive test coverage',
                priority: 'high',
            });
            let parsed: NormalizedToolResult = JSON.parse(add1);
            expect(parsed.success).toBe(true);

            const add2 = await agentLoop.executeTool('tasks_add', {
                title: 'Update docs',
                description: 'Document new features',
                priority: 'medium',
            });
            parsed = JSON.parse(add2);
            expect(parsed.success).toBe(true);

            // List pending tasks
            const listPending = await agentLoop.executeTool('tasks_list', {
                status: 'pending',
            });
            parsed = JSON.parse(listPending);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('Write tests');
            expect(parsed.data).toContain('Update docs');

            // Complete a task (extract ID from list)
            const taskData = parsed.data as string;
            const idMatch = taskData.match(/ID: (\d+)/);
            if (idMatch) {
                const taskId = idMatch[1];
                const complete = await agentLoop.executeTool('tasks_complete', {
                    id: taskId,
                });
                parsed = JSON.parse(complete);
                expect(parsed.success).toBe(true);
            }

            // List completed tasks
            const listCompleted = await agentLoop.executeTool('tasks_list', {
                status: 'completed',
            });
            parsed = JSON.parse(listCompleted);
            expect(parsed.success).toBe(true);
        });
    });

    describe('Error Recovery and Edge Cases', () => {
        it('should handle invalid arguments gracefully', async () => {
            const result = await agentLoop.executeTool('file_read', {
                path: null,
            });
            const parsed: NormalizedToolResult = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
            expect(parsed).toHaveProperty('meta');
        });

        it('should handle very large file operations', async () => {
            const largeContent = 'x'.repeat(100000);
            const largeFile = path.join(testDir, 'large.txt');

            const writeResult = await agentLoop.executeTool('file_write', {
                path: largeFile,
                content: largeContent,
            });
            let parsed: NormalizedToolResult = JSON.parse(writeResult);
            expect(parsed.success).toBe(true);

            const readResult = await agentLoop.executeTool('file_read', {
                path: largeFile,
            });
            parsed = JSON.parse(readResult);
            expect(parsed.success).toBe(true);
            expect((parsed.data as string).length).toBeGreaterThan(90000);
        });

        it('should handle concurrent tool executions', async () => {
            const promises = [
                agentLoop.executeTool('shell_execute', { command: 'echo "test1"' }),
                agentLoop.executeTool('shell_execute', { command: 'echo "test2"' }),
                agentLoop.executeTool('shell_execute', { command: 'echo "test3"' }),
            ];

            const results = await Promise.all(promises);
            
            for (const result of results) {
                const parsed: NormalizedToolResult = JSON.parse(result);
                expect(parsed.success).toBe(true);
                expect(parsed).toHaveProperty('meta');
            }
        });

        it('should handle special characters in file content', async () => {
            const specialContent = 'Special chars: "quotes" \'apostrophes\' \\backslash\n\ttabs\n🎉 emoji';
            const specialFile = path.join(testDir, 'special.txt');

            const writeResult = await agentLoop.executeTool('file_write', {
                path: specialFile,
                content: specialContent,
            });
            let parsed: NormalizedToolResult = JSON.parse(writeResult);
            expect(parsed.success).toBe(true);

            const readResult = await agentLoop.executeTool('file_read', {
                path: specialFile,
            });
            parsed = JSON.parse(readResult);
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('🎉');
            expect(parsed.data).toContain('quotes');
        });
    });

    describe('Tool Metadata Consistency', () => {
        it('all tools should include consistent metadata', async () => {
            const tools = [
                { name: 'file_read', args: { path: path.join(testDir, 'test1.txt') } },
                { name: 'file_list', args: { path: testDir } },
                { name: 'shell_execute', args: { command: 'pwd' } },
                { name: 'tasks_list', args: { status: 'all' } },
                { name: 'notes_search', args: { query: 'test' } },
            ];

            for (const { name, args } of tools) {
                const result = await agentLoop.executeTool(name, args);
                const parsed: NormalizedToolResult = JSON.parse(result);

                // Check structure
                expect(parsed).toHaveProperty('success');
                expect(typeof parsed.success).toBe('boolean');
                expect(parsed).toHaveProperty('data');
                expect(parsed).toHaveProperty('error');
                expect(parsed).toHaveProperty('meta');

                // Check metadata
                expect(parsed.meta).toHaveProperty('duration_ms');
                expect(typeof parsed.meta.duration_ms).toBe('number');
                expect(parsed.meta.duration_ms).toBeGreaterThanOrEqual(0);
                
                expect(parsed.meta).toHaveProperty('timestamp');
                expect(typeof parsed.meta.timestamp).toBe('string');
                expect(new Date(parsed.meta.timestamp).toISOString()).toBe(parsed.meta.timestamp);

                // Check error structure
                if (!parsed.success) {
                    expect(parsed.error).not.toBeNull();
                    expect(parsed.error).toHaveProperty('code');
                    expect(parsed.error).toHaveProperty('message');
                    expect(parsed.data).toBeNull();
                } else {
                    expect(parsed.error).toBeNull();
                }
            }
        });

        it('should track execution time accurately', async () => {
            const result = await agentLoop.executeTool('shell_execute', {
                command: 'sleep 0.1',
            });
            const parsed: NormalizedToolResult = JSON.parse(result);

            expect(parsed.meta.duration_ms).toBeGreaterThanOrEqual(100);
            expect(parsed.meta.duration_ms).toBeLessThan(500);
        });
    });
});
