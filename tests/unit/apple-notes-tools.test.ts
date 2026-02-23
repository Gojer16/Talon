// ─── Apple Notes Tools Tests ──────────────────────────────────────
// TDD: Tests for Apple Notes automation via AppleScript (bulletproof JSON output)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the child_process module
vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

// Mock fs for safeExecAppleScript temp file handling
vi.mock('fs', () => ({
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
}));

import { exec } from 'child_process';
import { appleNotesTools } from '@/tools/apple-notes.js';

describe('Apple Notes Tools', () => {
    const mockedExec = vi.mocked(exec);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tool Definitions', () => {
        it('should export 2 Notes tools', () => {
            expect(appleNotesTools).toHaveLength(2);
        });

        it('should have correct tool names', () => {
            const toolNames = appleNotesTools.map(t => t.name);
            expect(toolNames).toContain('apple_notes_create');
            expect(toolNames).toContain('apple_notes_search');
        });

        it('should have descriptions for all tools', () => {
            appleNotesTools.forEach(tool => {
                expect(tool.description).toBeDefined();
                expect(tool.description.length).toBeGreaterThan(0);
                expect(tool.description).toContain('macOS only');
            });
        });

        it('should have parameter schemas for all tools', () => {
            appleNotesTools.forEach(tool => {
                expect(tool.parameters).toBeDefined();
                expect(tool.parameters.type).toBe('object');
                expect(tool.parameters.properties).toBeDefined();
            });
        });

        it('should have execute functions for all tools', () => {
            appleNotesTools.forEach(tool => {
                expect(typeof tool.execute).toBe('function');
            });
        });
    });

    describe('apple_notes_create', () => {
        const tool = appleNotesTools.find(t => t.name === 'apple_notes_create')!;

        it('should have correct parameters', () => {
            expect(tool.parameters.required).toContain('title');
            expect(tool.parameters.required).toContain('content');
            expect(tool.parameters.properties).toHaveProperty('title');
            expect(tool.parameters.properties).toHaveProperty('content');
            expect(tool.parameters.properties).toHaveProperty('folder');
        });

        it('should return JSON error on non-macOS platform', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = await tool.execute({
                title: 'Test Note',
                content: 'Test content'
            });

            Object.defineProperty(process, 'platform', originalPlatform!);
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('PLATFORM_NOT_SUPPORTED');
            expect(parsed.error.message).toContain('macOS');
        });

        it('should return validation error for empty title', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            const result = await tool.execute({ title: '', content: 'Some content' });

            Object.defineProperty(process, 'platform', originalPlatform!);
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('VALIDATION_ERROR');
        });

        it('should return validation error for missing content', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            const result = await tool.execute({ title: 'Test' });

            Object.defineProperty(process, 'platform', originalPlatform!);
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('VALIDATION_ERROR');
        });

        it('should attempt to create note on macOS', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                const actualCallback = callback || options;
                if (typeof actualCallback === 'function') {
                    setTimeout(() => actualCallback(null, { stdout: 'My Note', stderr: '' }), 0);
                }
                return {} as any;
            });

            const result = await tool.execute({ title: 'My Note', content: 'My content' });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.title).toBe('My Note');
        });
    });

    describe('apple_notes_search', () => {
        const tool = appleNotesTools.find(t => t.name === 'apple_notes_search')!;

        it('should have correct parameters', () => {
            expect(tool.parameters.required).toContain('query');
            expect(tool.parameters.properties).toHaveProperty('query');
            expect(tool.parameters.properties).toHaveProperty('limit');
        });

        it('should return JSON error on non-macOS platform', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const result = await tool.execute({ query: 'test' });

            Object.defineProperty(process, 'platform', originalPlatform!);
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('PLATFORM_NOT_SUPPORTED');
            expect(parsed.error.message).toContain('macOS');
        });

        it('should return validation error for empty query', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            const result = await tool.execute({ query: '' });

            Object.defineProperty(process, 'platform', originalPlatform!);
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('VALIDATION_ERROR');
        });

        it('should attempt to search on macOS', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                const actualCallback = callback || options;
                if (typeof actualCallback === 'function') {
                    setTimeout(() => actualCallback(null, { stdout: 'Test Note§Preview content', stderr: '' }), 0);
                }
                return {} as any;
            });

            const result = await tool.execute({ query: 'test' });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.notes).toBeDefined();
        });
    });

    describe('Platform Detection', () => {
        it('should reject on Linux', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const createTool = appleNotesTools.find(t => t.name === 'apple_notes_create')!;
            const result = await createTool.execute({
                title: 'Test',
                content: 'Test',
            });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.message).toContain('macOS');
        });

        it('should reject on Windows', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const searchTool = appleNotesTools.find(t => t.name === 'apple_notes_search')!;
            const result = await searchTool.execute({ query: 'test' });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.message).toContain('macOS');
        });
    });
});
