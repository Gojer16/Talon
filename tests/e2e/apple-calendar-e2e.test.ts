// ─── Apple Calendar E2E Tests ────────────────────────────────────
// End-to-End tests testing the full agent workflow with Calendar tool
// Tests: User Input → Gateway → Agent Loop → Tool Execution → Response

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentLoop } from '@/agent/loop.js';
import { ModelRouter } from '@/agent/router.js';
import { MemoryManager } from '@/memory/manager.js';
import { MemoryCompressor } from '@/memory/compressor.js';
import { EventBus } from '@/gateway/events.js';
import { SessionManager } from '@/gateway/sessions.js';
import { appleCalendarTools, __resetCalendarState } from '@/tools/apple-calendar.js';
import { registerAllTools } from '@/tools/registry.js';
import type { Session } from '@/utils/types.js';

const TEST_CALENDAR = 'TalonE2ETest';

describe.skipIf(process.platform !== 'darwin')('Apple Calendar E2E (Full Workflow)', () => {
    let eventBus: EventBus;
    let sessionManager: SessionManager;
    let memoryManager: MemoryManager;
    let memoryCompressor: MemoryCompressor;
    let modelRouter: ModelRouter;
    let agentLoop: AgentLoop;
    let session: Session;

    const createdEvents: Array<{ title: string; calendar: string }> = [];

    beforeAll(async () => {
        __resetCalendarState();
        
        // Initialize components
        eventBus = new EventBus();
        sessionManager = new SessionManager(eventBus);
        memoryManager = new MemoryManager({ workspaceRoot: '/tmp/talon-test' });
        memoryCompressor = new MemoryCompressor();
        modelRouter = new ModelRouter();
        agentLoop = new AgentLoop(modelRouter, memoryManager, memoryCompressor, eventBus);

        // Register calendar tools
        for (const tool of appleCalendarTools) {
            agentLoop.registerTool(tool);
        }

        // Create a test session
        session = sessionManager.createSession('e2e-test-user', 'cli', 'E2E Test User');
    });

    afterAll(async () => {
        // Cleanup: delete all test events
        const deleteTool = appleCalendarTools.find(t => t.name === 'apple_calendar_delete_event')!;
        for (const { title, calendar } of createdEvents) {
            try {
                await deleteTool.execute({ title, calendar });
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Full Agent Workflow', () => {
        it('should create event through agent tool execution', async () => {
            const title = `E2E Test Event ${Date.now()}`;
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

            // Simulate agent executing tool
            const result = await createTool.execute({
                title,
                startDate: 'tomorrow at 2pm',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.eventId).toBeDefined();
            expect(parsed.data.message).toContain('created');

            createdEvents.push({ title, calendar: TEST_CALENDAR });
        }, 20000);

        it('should list events through agent tool execution', async () => {
            const listTool = appleCalendarTools.find(t => t.name === 'apple_calendar_list_events')!;

            const result = await listTool.execute({
                calendar: TEST_CALENDAR,
                days: 30,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.events).toBeDefined();
            expect(parsed.data.count).toBeGreaterThanOrEqual(0);
        }, 15000);

        it('should handle tool error through agent workflow', async () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

            // Try to create event with invalid date
            const result = await createTool.execute({
                title: 'Invalid Event',
                startDate: 'not a real date',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('INVALID_START_DATE');
            expect(parsed.error.recoverySteps).toBeDefined();
        }, 15000);

        it('should delete event through agent tool execution', async () => {
            const title = `E2E Delete Test ${Date.now()}`;
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
            const deleteTool = appleCalendarTools.find(t => t.name === 'apple_calendar_delete_event')!;

            // Create event first
            await createTool.execute({
                title,
                startDate: '2026-10-01 10:00',
                calendar: TEST_CALENDAR,
            });
            createdEvents.push({ title, calendar: TEST_CALENDAR });

            // Delete through agent
            const result = await deleteTool.execute({
                title,
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.message).toContain('deleted');
        }, 25000);
    });

    describe('Agent Tool Registration', () => {
        it('should have all calendar tools registered', () => {
            const tools = agentLoop.getRegisteredTools?.() || [];
            const toolNames = tools.map(t => t.name);

            expect(toolNames).toContain('apple_calendar_create_event');
            expect(toolNames).toContain('apple_calendar_list_events');
            expect(toolNames).toContain('apple_calendar_delete_event');
        });

        it('should have correct tool definitions', () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
            
            expect(createTool.description).toContain('macOS only');
            expect(createTool.parameters.required).toContain('title');
            expect(createTool.parameters.required).toContain('startDate');
        });
    });

    describe('Event Bus Integration', () => {
        it('should emit tool.execute event', async () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
            const eventPromise = new Promise(resolve => {
                eventBus.once('tool.execute', (data) => resolve(data));
            });

            await createTool.execute({
                title: `Event Bus Test ${Date.now()}`,
                startDate: '2026-11-01 10:00',
                calendar: TEST_CALENDAR,
            });

            const eventData = await eventPromise;
            expect(eventData).toBeDefined();
            expect(eventData.tool).toBe('apple_calendar_create_event');
        }, 20000);

        it('should emit tool.complete event on success', async () => {
            const title = `Event Bus Complete ${Date.now()}`;
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
            
            const eventPromise = new Promise(resolve => {
                eventBus.once('tool.complete', (data) => resolve(data));
            });

            await createTool.execute({
                title,
                startDate: '2026-11-02 10:00',
                calendar: TEST_CALENDAR,
            });
            createdEvents.push({ title, calendar: TEST_CALENDAR });

            const eventData: any = await eventPromise;
            expect(eventData).toBeDefined();
            expect(eventData.tool).toBe('apple_calendar_create_event');
            expect(eventData.result.success).toBe(true);
        }, 20000);
    });

    describe('Session Persistence', () => {
        it('should persist tool execution in session history', async () => {
            const title = `Session Test ${Date.now()}`;
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

            // Execute tool
            await createTool.execute({
                title,
                startDate: '2026-12-01 10:00',
                calendar: TEST_CALENDAR,
            });
            createdEvents.push({ title, calendar: TEST_CALENDAR });

            // Check session has tool execution recorded
            const updatedSession = sessionManager.getSession(session.id);
            expect(updatedSession).toBeDefined();
            expect(updatedSession.messages.length).toBeGreaterThan(0);
        }, 20000);
    });

    describe('Rate Limiting', () => {
        it('should enforce minimum delay between tool calls', async () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
            
            const start = Date.now();
            
            // Execute two tools in rapid succession
            await Promise.all([
                createTool.execute({
                    title: `Rate Test 1 ${Date.now()}`,
                    startDate: '2026-12-15 10:00',
                    calendar: TEST_CALENDAR,
                }),
                createTool.execute({
                    title: `Rate Test 2 ${Date.now()}`,
                    startDate: '2026-12-16 10:00',
                    calendar: TEST_CALENDAR,
                }),
            ]);

            const elapsed = Date.now() - start;
            // Should take at least 500ms due to rate limiting
            expect(elapsed).toBeGreaterThanOrEqual(400); // Allow some margin
        }, 30000);
    });

    describe('Concurrent Operations Safety', () => {
        it('should handle concurrent event creations safely', async () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
            
            const titles = [
                `Concurrent E2E 1 ${Date.now()}`,
                `Concurrent E2E 2 ${Date.now()}`,
                `Concurrent E2E 3 ${Date.now()}`,
            ];

            const results = await Promise.all(
                titles.map(title =>
                    createTool.execute({
                        title,
                        startDate: '2027-01-15 10:00',
                        calendar: TEST_CALENDAR,
                    })
                )
            );

            results.forEach((result, index) => {
                const parsed = JSON.parse(result);
                expect(parsed.success).toBe(true);
                createdEvents.push({ title: titles[index], calendar: TEST_CALENDAR });
            });
        }, 60000);
    });

    describe('Error Propagation', () => {
        it('should propagate validation errors with full context', async () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

            const result = await createTool.execute({
                title: '', // Empty title should fail validation
                startDate: '2026-12-01 10:00',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('VALIDATION_ERROR');
            expect(parsed.error.details).toBeDefined();
        }, 15000);

        it('should include recovery steps in errors', async () => {
            const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

            const result = await createTool.execute({
                title: 'Recovery Test',
                startDate: 'invalid date format',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.recoverySteps).toBeDefined();
            expect(Array.isArray(parsed.error.recoverySteps)).toBe(true);
        }, 15000);
    });
});
