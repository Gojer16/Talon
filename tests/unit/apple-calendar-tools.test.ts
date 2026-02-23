// ─── Apple Calendar Tools Tests ───────────────────────────────────
// TDD: Tests for Apple Calendar automation via AppleScript with JSON responses

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the child_process module
vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

import { exec } from 'child_process';
import { appleCalendarTools, __resetCalendarState } from '@/tools/apple-calendar.js';

describe('Apple Calendar Tools', () => {
    const mockedExec = vi.mocked(exec);

    beforeEach(() => {
        vi.clearAllMocks();
        __resetCalendarState();
        
        // Mock exec for both pgrep and osascript commands
        mockedExec.mockImplementation((command: string, options: any, callback: any) => {
            // Handle cases where options is actually the callback
            const actualCallback = typeof options === 'function' ? options : callback;
            
            // Handle pgrep command for calendar running check
            if (command && command.includes('pgrep')) {
                setTimeout(() => actualCallback(null, { stdout: '12345\n', stderr: '' }), 0);
                return {} as any;
            }
            // Handle osascript commands
            if (command && command.startsWith('osascript')) {
                // Handle permission test script
                if (command.includes('name of calendar 1')) {
                    setTimeout(() => actualCallback(null, { stdout: 'Home', stderr: '' }), 0);
                } else {
                    // Handle all other osascript commands
                    setTimeout(() => actualCallback(null, { stdout: 'SUCCESS§test-uid§Test Event', stderr: '' }), 0);
                }
            }
            return {} as any;
        });
    });

    describe('Tool Definitions', () => {
        it('should export 3 Calendar tools', () => {
            expect(appleCalendarTools).toHaveLength(3);
        });

        it('should have correct tool names', () => {
            const toolNames = appleCalendarTools.map(t => t.name);
            expect(toolNames).toContain('apple_calendar_create_event');
            expect(toolNames).toContain('apple_calendar_list_events');
            expect(toolNames).toContain('apple_calendar_delete_event');
        });

        it('should have descriptions for all tools', () => {
            appleCalendarTools.forEach(tool => {
                expect(tool.description).toBeDefined();
                expect(tool.description.length).toBeGreaterThan(0);
                expect(tool.description).toContain('macOS only');
            });
        });

        it('should have parameter schemas for all tools', () => {
            appleCalendarTools.forEach(tool => {
                expect(tool.parameters).toBeDefined();
                expect(tool.parameters.type).toBe('object');
                expect(tool.parameters.properties).toBeDefined();
            });
        });

        it('should have execute functions for all tools', () => {
            appleCalendarTools.forEach(tool => {
                expect(typeof tool.execute).toBe('function');
            });
        });
    });

    describe('apple_calendar_create_event', () => {
        const tool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

        it('should have correct parameters', () => {
            expect(tool.parameters.required).toContain('title');
            expect(tool.parameters.required).toContain('startDate');
            expect(tool.parameters.properties).toHaveProperty('title');
            expect(tool.parameters.properties).toHaveProperty('startDate');
            expect(tool.parameters.properties).toHaveProperty('endDate');
            expect(tool.parameters.properties).toHaveProperty('location');
            expect(tool.parameters.properties).toHaveProperty('notes');
            expect(tool.parameters.properties).toHaveProperty('calendar');
        });

        it('should return JSON error on non-macOS platform', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            const result = await tool.execute({ 
                title: 'Meeting', 
                startDate: '2026-02-20 10:00' 
            });

            Object.defineProperty(process, 'platform', originalPlatform!);
            
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('PLATFORM_NOT_SUPPORTED');
            expect(parsed.error.message).toContain('macOS');
        });

        it('should parse flexible date formats', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            // Mock both pgrep and osascript commands
            let callCount = 0;
            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                const actualCallback = typeof options === 'function' ? options : callback;
                
                if (command && command.includes('pgrep')) {
                    setTimeout(() => actualCallback(null, { stdout: '12345\n', stderr: '' }), 0);
                    return {} as any;
                }
                
                if (command && command.startsWith('osascript')) {
                    callCount++;
                    console.log(`Mock call ${callCount}: ${command.substring(0, 50)}...`);
                    // First call is permission check
                    if (callCount === 1 && command.includes('name of calendar 1')) {
                        setTimeout(() => actualCallback(null, { stdout: 'Home', stderr: '' }), 0);
                    } else {
                        // Main operation
                        setTimeout(() => actualCallback(null, { stdout: 'SUCCESS§test-uid-123§Team Meeting', stderr: '' }), 0);
                    }
                }
                return {} as any;
            });

            const result = await tool.execute({
                title: 'Team Meeting',
                startDate: 'tomorrow at 3pm'
            });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.eventId).toBe('test-uid-123');
        }, 15000); // 15 second timeout

        it('should return error with suggestions for ambiguous dates', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            const result = await tool.execute({ 
                title: 'Meeting', 
                startDate: 'invalid date string xyz' 
            });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('INVALID_START_DATE');
        });

        it('should detect permission errors', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            // Mock permission check to succeed, but main operation to fail
            let callCount = 0;
            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                const actualCallback = typeof options === 'function' ? options : callback;
                
                if (command && command.includes('pgrep')) {
                    setTimeout(() => actualCallback(null, { stdout: '12345\n', stderr: '' }), 0);
                    return {} as any;
                }
                
                if (command && command.startsWith('osascript')) {
                    callCount++;
                    // First call is permission check - succeed
                    if (callCount === 1 && command.includes('name of calendar 1')) {
                        setTimeout(() => actualCallback(null, { stdout: 'Home', stderr: '' }), 0);
                    } else {
                        // Subsequent calls fail with permission error
                        setTimeout(() => actualCallback(null, { stdout: '', stderr: 'not authorized to send Apple events' }), 0);
                    }
                }
                return {} as any;
            });

            const result = await tool.execute({
                title: 'Meeting',
                startDate: '2026-02-24 09:00'
            });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('PERMISSION_DENIED');
            expect(parsed.error.recoverySteps).toBeDefined();
            expect(parsed.error.recoverySteps.length).toBeGreaterThan(0);
        }, 15000);
    });

    describe('apple_calendar_list_events', () => {
        const tool = appleCalendarTools.find(t => t.name === 'apple_calendar_list_events')!;

        it('should have correct parameters', () => {
            expect(tool.parameters.properties).toHaveProperty('calendar');
            expect(tool.parameters.properties).toHaveProperty('days');
        });

        it('should return JSON error on non-macOS platform', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'win32',
            });

            const result = await tool.execute({});

            Object.defineProperty(process, 'platform', originalPlatform!);
            
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('PLATFORM_NOT_SUPPORTED');
        });

        it('should return structured event list', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            // Mock with newline separator (matching AppleScript output)
            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                if (command && command.startsWith('osascript')) {
                    setTimeout(() => callback(null, {
                        stdout: 'uid-1§Meeting§Feb 24 2026 10:00:00 AM§Office§Talon\nuid-2§Lunch§Feb 24 2026 12:00:00 PM§Cafe§Talon',
                        stderr: ''
                    }), 0);
                }
                return {} as any;
            });

            const result = await tool.execute({ days: 7 });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.events).toBeDefined();
            expect(parsed.data.events.length).toBeGreaterThan(0);
            expect(parsed.data.events[0].id).toBeDefined();
            expect(parsed.data.events[0].title).toBeDefined();
        });
    });

    describe('apple_calendar_delete_event', () => {
        const tool = appleCalendarTools.find(t => t.name === 'apple_calendar_delete_event')!;

        it('should have correct parameters', () => {
            expect(tool.parameters.required).toContain('title');
            expect(tool.parameters.properties).toHaveProperty('title');
            expect(tool.parameters.properties).toHaveProperty('calendar');
        });

        it('should return JSON error on non-macOS platform', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'linux',
            });

            const result = await tool.execute({ title: 'Meeting' });

            Object.defineProperty(process, 'platform', originalPlatform!);
            
            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('PLATFORM_NOT_SUPPORTED');
        });

        it('should return success when event is deleted', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                if (command && command.startsWith('osascript')) {
                    setTimeout(() => callback(null, { stdout: 'DELETED', stderr: '' }), 0);
                }
                return {} as any;
            });

            const result = await tool.execute({ title: 'Meeting' });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.message).toContain('deleted');
        });

        it('should return error when event not found', async () => {
            const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
            });

            mockedExec.mockImplementation((command: string, options: any, callback: any) => {
                if (command && command.startsWith('osascript')) {
                    setTimeout(() => callback(null, { stdout: 'EVENT_NOT_FOUND', stderr: '' }), 0);
                }
                return {} as any;
            });

            const result = await tool.execute({ title: 'NonExistent' });

            Object.defineProperty(process, 'platform', originalPlatform!);

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('EVENT_NOT_FOUND');
        });
    });

    describe('Platform Detection', () => {
        it('should reject on non-macOS platforms with JSON', async () => {
            const platforms = ['linux', 'win32'];
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

            for (const platform of platforms) {
                const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
                Object.defineProperty(process, 'platform', {
                    value: platform,
                });

                const result = await createTool.execute({
                    title: 'Test',
                    startDate: '2026-02-20 10:00',
                });

                Object.defineProperty(process, 'platform', originalPlatform!);

                const parsed = JSON.parse(result);
                expect(parsed.success).toBe(false);
                expect(parsed.error.code).toBe('PLATFORM_NOT_SUPPORTED');
            }
        });
    });
});
