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

describe('File Tools Comprehensive', () => {
    let agentLoop: AgentLoop;
    let testDir: string;

    beforeAll(async () => {
        testDir = path.join(os.tmpdir(), `talon-file-test-${Date.now()}`);
        fs.mkdirSync(testDir, { recursive: true });

        const config: TalonConfig = {
            workspace: { root: testDir },
            agent: { model: 'test', maxIterations: 5, subagentModel: 'test', providers: {} },
            tools: {
                files: {
                    enabled: true,
                    allowedPaths: [testDir],
                    deniedPaths: [path.join(testDir, 'denied')],
                    maxFileSize: 1048576,
                },
                shell: { enabled: false, defaultTimeout: 5000, maxOutputSize: 10000, blockedCommands: [], confirmDestructive: false },
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

    describe('file_read', () => {
        it('should read entire file', async () => {
            const file = path.join(testDir, 'read-test.txt');
            fs.writeFileSync(file, 'Line 1\nLine 2\nLine 3');
            
            const result = await agentLoop.executeTool('file_read', { path: file });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('Line 1');
            expect(parsed.data).toContain('Line 3');
        });

        it('should read file with line range', async () => {
            const file = path.join(testDir, 'range-test.txt');
            fs.writeFileSync(file, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
            
            const result = await agentLoop.executeTool('file_read', { path: file, startLine: 2, endLine: 4 });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('Line 2');
            expect(parsed.data).toContain('Line 4');
            expect(parsed.data).not.toContain('Line 1');
            expect(parsed.data).not.toContain('Line 5');
        });

        it('should reject denied paths', async () => {
            const deniedDir = path.join(testDir, 'denied');
            fs.mkdirSync(deniedDir, { recursive: true });
            const file = path.join(deniedDir, 'secret.txt');
            fs.writeFileSync(file, 'secret');
            
            const result = await agentLoop.executeTool('file_read', { path: file });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(false);
            expect(parsed.error?.message).toContain('Access denied');
        });

        it('should handle missing files', async () => {
            const result = await agentLoop.executeTool('file_read', { path: path.join(testDir, 'missing.txt') });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(false);
            expect(parsed.error?.message).toContain('not found');
        });

        it('should reject directories', async () => {
            const result = await agentLoop.executeTool('file_read', { path: testDir });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(false);
            expect(parsed.error?.message).toContain('directory');
        });
    });

    describe('file_write', () => {
        it('should create new file', async () => {
            const file = path.join(testDir, 'new-file.txt');
            const result = await agentLoop.executeTool('file_write', { path: file, content: 'New content' });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(fs.existsSync(file)).toBe(true);
            expect(fs.readFileSync(file, 'utf-8')).toBe('New content');
        });

        it('should overwrite existing file', async () => {
            const file = path.join(testDir, 'overwrite.txt');
            fs.writeFileSync(file, 'Old content');
            
            const result = await agentLoop.executeTool('file_write', { path: file, content: 'New content' });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(fs.readFileSync(file, 'utf-8')).toBe('New content');
        });

        it('should create parent directories', async () => {
            const file = path.join(testDir, 'nested', 'deep', 'file.txt');
            const result = await agentLoop.executeTool('file_write', { path: file, content: 'Deep content' });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(fs.existsSync(file)).toBe(true);
        });

        it('should handle empty content', async () => {
            const file = path.join(testDir, 'empty.txt');
            const result = await agentLoop.executeTool('file_write', { path: file, content: '' });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(fs.readFileSync(file, 'utf-8')).toBe('');
        });
    });

    describe('file_list', () => {
        it('should list directory contents', async () => {
            fs.writeFileSync(path.join(testDir, 'file1.txt'), 'a');
            fs.writeFileSync(path.join(testDir, 'file2.txt'), 'b');
            fs.mkdirSync(path.join(testDir, 'subdir'), { recursive: true });
            
            const result = await agentLoop.executeTool('file_list', { path: testDir });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('file1.txt');
            expect(parsed.data).toContain('file2.txt');
            expect(parsed.data).toContain('subdir');
        });

        it('should handle empty directory', async () => {
            const emptyDir = path.join(testDir, 'empty-dir');
            fs.mkdirSync(emptyDir, { recursive: true });
            
            const result = await agentLoop.executeTool('file_list', { path: emptyDir });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
        });
    });

    describe('file_search', () => {
        beforeAll(() => {
            fs.writeFileSync(path.join(testDir, 'search1.txt'), 'Hello World\nFoo Bar');
            fs.writeFileSync(path.join(testDir, 'search2.txt'), 'Hello Universe\nBaz Qux');
            fs.writeFileSync(path.join(testDir, 'search3.txt'), 'Goodbye World');
        });

        it('should find pattern in files', async () => {
            const result = await agentLoop.executeTool('file_search', { path: testDir, pattern: 'Hello' });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            expect(parsed.data).toContain('search1.txt');
            expect(parsed.data).toContain('search2.txt');
        });

        it('should handle no matches', async () => {
            const result = await agentLoop.executeTool('file_search', { path: testDir, pattern: 'NONEXISTENT_PATTERN_XYZ' });
            const parsed: NormalizedToolResult = JSON.parse(result);
            
            expect(parsed.success).toBe(true);
            // May return "No matches" or empty results
            expect(parsed.data).toBeDefined();
        });
    });
});
