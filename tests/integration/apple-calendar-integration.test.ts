// ─── Apple Calendar Integration Tests ────────────────────────────
// Real AppleScript execution tests with actual Calendar app (macOS only)
// Tests the full integration without mocking

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appleCalendarTools, __resetCalendarState } from '@/tools/apple-calendar.js';

const TEST_CALENDAR = 'TalonIntegrationTest';

describe.skipIf(process.platform !== 'darwin')('Apple Calendar Integration (Real)', () => {
    const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;
    const listTool = appleCalendarTools.find(t => t.name === 'apple_calendar_list_events')!;
    const deleteTool = appleCalendarTools.find(t => t.name === 'apple_calendar_delete_event')!;

    const createdEvents: Array<{ title: string; calendar: string }> = [];

    beforeAll(() => {
        __resetCalendarState();
    });

    afterAll(async () => {
        // Cleanup: delete all test events
        for (const { title, calendar } of createdEvents) {
            try {
                await deleteTool.execute({ title, calendar });
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Event Creation - Real Execution', () => {
        it('should create a simple event with natural language date', async () => {
            const title = `Integration Test Event ${Date.now()}`;
            const result = await createTool.execute({
                title,
                startDate: 'tomorrow at 3pm',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.eventId).toBeDefined();
            expect(parsed.data.calendar).toBe(TEST_CALENDAR);
            expect(parsed.data.startDate).toBeDefined();
            expect(parsed.data.endDate).toBeDefined();
            expect(parsed.data.timezone).toBeDefined();

            createdEvents.push({ title, calendar: TEST_CALENDAR });
        }, 20000);

        it('should create event with location and notes', async () => {
            const title = `Detailed Event ${Date.now()}`;
            const result = await createTool.execute({
                title,
                startDate: '2026-03-15 10:00',
                location: 'Conference Room A',
                notes: 'Important meeting with stakeholders',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.eventId).toBeDefined();

            createdEvents.push({ title, calendar: TEST_CALENDAR });
        }, 20000);

        it('should create recurring weekly event', async () => {
            const title = `Weekly Standup ${Date.now()}`;
            const result = await createTool.execute({
                title,
                startDate: '2026-03-02 09:00',
                recurrence: {
                    frequency: 'weekly',
                    count: 4,
                },
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.recurrence).toBeDefined();
            expect(parsed.data.recurrence.frequency).toBe('weekly');
            expect(parsed.data.recurrence.interval).toBe(1);

            createdEvents.push({ title, calendar: TEST_CALENDAR });
        }, 30000);

        it('should handle special characters in title', async () => {
            const title = `Test "Quotes" & Symbols ${Date.now()}`;
            const result = await createTool.execute({
                title,
                startDate: '2026-03-10 11:00',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);

            createdEvents.push({ title, calendar: TEST_CALENDAR });
        }, 20000);

        it('should detect duplicate event (idempotency)', async () => {
            const title = `Duplicate Test ${Date.now()}`;
            
            // Create first event
            const result1 = await createTool.execute({
                title,
                startDate: '2026-04-01 14:00',
                calendar: TEST_CALENDAR,
            });

            const parsed1 = JSON.parse(result1);
            expect(parsed1.success).toBe(true);
            expect(parsed1.data.status).toBe('CREATED');

            createdEvents.push({ title, calendar: TEST_CALENDAR });

            // Try to create same event again
            const result2 = await createTool.execute({
                title,
                startDate: '2026-04-01 14:00',
                calendar: TEST_CALENDAR,
            });

            const parsed2 = JSON.parse(result2);
            expect(parsed2.success).toBe(true);
            expect(parsed2.data.status).toBe('ALREADY_EXISTS');
        }, 30000);
    });

    describe('Event Listing - Real Execution', () => {
        it('should list events from test calendar', async () => {
            // First create an event
            const title = `List Test ${Date.now()}`;
            await createTool.execute({
                title,
                startDate: 'tomorrow at 2pm',
                calendar: TEST_CALENDAR,
            });
            createdEvents.push({ title, calendar: TEST_CALENDAR });

            // Then list events
            const result = await listTool.execute({
                calendar: TEST_CALENDAR,
                days: 30,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.events).toBeDefined();
            expect(parsed.data.count).toBeGreaterThanOrEqual(1);
            expect(parsed.data.events[0].id).toBeDefined();
            expect(parsed.data.events[0].title).toBeDefined();
        }, 20000);

        it('should return empty list for calendar with no events', async () => {
            const emptyCalendar = 'TalonEmptyTest';
            const result = await listTool.execute({
                calendar: emptyCalendar,
                days: 1,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.events).toEqual([]);
        }, 15000);

        it('should list events from all calendars', async () => {
            const result = await listTool.execute({
                days: 7,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.events).toBeDefined();
        }, 15000);
    });

    describe('Event Deletion - Real Execution', () => {
        it('should delete an existing event', async () => {
            const title = `Delete Test ${Date.now()}`;

            // Create event first
            await createTool.execute({
                title,
                startDate: '2026-03-20 15:00',
                calendar: TEST_CALENDAR,
            });
            createdEvents.push({ title, calendar: TEST_CALENDAR });

            // Delete event
            const result = await deleteTool.execute({
                title,
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.message).toContain('deleted');
        }, 20000);

        it('should return error for non-existent event', async () => {
            const result = await deleteTool.execute({
                title: 'NonExistent Event 999999',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('EVENT_NOT_FOUND');
        }, 15000);

        it('should delete event with fuzzy matching', async () => {
            const title = `Fuzzy Delete Test ${Date.now()}`;

            // Create event
            await createTool.execute({
                title,
                startDate: '2026-03-25 10:00',
                calendar: TEST_CALENDAR,
            });
            createdEvents.push({ title, calendar: TEST_CALENDAR });

            // Delete with partial title match
            const partialTitle = title.substring(0, 10);
            const result = await deleteTool.execute({
                title: partialTitle,
                calendar: TEST_CALENDAR,
                exact: false,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
        }, 25000);
    });

    describe('Error Handling - Real Execution', () => {
        it('should reject invalid date formats', async () => {
            const result = await createTool.execute({
                title: 'Invalid Date Test',
                startDate: 'not a valid date xyz',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('INVALID_START_DATE');
            expect(parsed.error.recoverySteps).toBeDefined();
        }, 15000);

        it('should handle permission errors gracefully', async () => {
            // This test verifies the error structure, but actual permission
            // errors depend on system settings
            const result = await createTool.execute({
                title: 'Permission Test',
                startDate: '2026-05-01 10:00',
                calendar: TEST_CALENDAR,
            });

            // Should either succeed or return proper permission error
            const parsed = JSON.parse(result);
            if (!parsed.success) {
                expect(parsed.error.code).toBeDefined();
                expect(parsed.error.message).toBeDefined();
            }
        }, 15000);

        it('should handle very long titles', async () => {
            const longTitle = 'A'.repeat(600); // Exceeds 500 char limit
            const result = await createTool.execute({
                title: longTitle,
                startDate: '2026-06-01 10:00',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('VALIDATION_ERROR');
        }, 10000);
    });

    describe('Date Parsing - Real Execution', () => {
        it('should parse various date formats', async () => {
            const formats = [
                'tomorrow at 3pm',
                'next Monday at 10am',
                '2026-07-15 14:00',
                'July 15 2026 2pm',
            ];

            for (const format of formats) {
                const title = `Date Format Test ${format} ${Date.now()}`;
                const result = await createTool.execute({
                    title,
                    startDate: format,
                    calendar: TEST_CALENDAR,
                });

                const parsed = JSON.parse(result);
                // Should either succeed or return helpful error
                if (!parsed.success) {
                    expect(parsed.error.code).toBeDefined();
                }
                
                createdEvents.push({ title, calendar: TEST_CALENDAR });
            }
        }, 60000);

        it('should handle date ranges', async () => {
            const title = `Date Range Test ${Date.now()}`;
            const result = await createTool.execute({
                title,
                startDate: '2026-08-01 3pm to 5pm',
                calendar: TEST_CALENDAR,
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
            expect(parsed.data.startDate).toBeDefined();
            expect(parsed.data.endDate).toBeDefined();

            createdEvents.push({ title, calendar: TEST_CALENDAR });
        }, 20000);
    });

    describe('Concurrent Operations', () => {
        it('should handle multiple rapid event creations', async () => {
            const titles = [
                `Concurrent 1 ${Date.now()}`,
                `Concurrent 2 ${Date.now()}`,
                `Concurrent 3 ${Date.now()}`,
            ];

            const results = await Promise.all(
                titles.map(title =>
                    createTool.execute({
                        title,
                        startDate: '2026-09-01 10:00',
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
});
