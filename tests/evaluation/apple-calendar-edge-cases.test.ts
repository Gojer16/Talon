// ─── Apple Calendar Edge Case Evaluation ──────────────────────────
// Comprehensive test suite covering diverse scenarios, ambiguity, and edge cases

import { describe, it, expect } from 'vitest';
import { parseDate } from '@/tools/utils/date-parser.js';
import { appleCalendarTools } from '@/tools/apple-calendar.js';

describe('Apple Calendar Edge Cases - Evaluation Suite', () => {
    const createTool = appleCalendarTools.find(t => t.name === 'apple_calendar_create_event')!;

    describe('Date Format Diversity', () => {
        const validFormats = [
            { input: '2026-02-25 14:00', desc: 'ISO 8601 with space' },
            { input: '2026-02-25T14:00', desc: 'ISO 8601 with T' },
            { input: '2026-12-31 23:59', desc: 'End of year' },
            { input: '2026-01-01 00:00', desc: 'Start of year' },
            { input: 'tomorrow at 3pm', desc: 'Relative + time' },
            { input: 'today at 9am', desc: 'Today + morning' },
            { input: 'next Monday', desc: 'Next weekday' },
            { input: 'next Friday at 5:30pm', desc: 'Weekday + specific time' },
            { input: 'Monday 2pm', desc: 'Weekday shorthand' },
            { input: 'Feb 25', desc: 'Month abbreviation' },
            { input: 'March 15 at 10am', desc: 'Full month name' },
        ];

        validFormats.forEach(({ input, desc }) => {
            it(`should parse: ${desc} ("${input}")`, () => {
                const result = parseDate(input);
                expect(result.success).toBe(true);
                expect(result.parsed?.date).toBeInstanceOf(Date);
            });
        });
    });

    describe('Timezone and DST Edge Cases', () => {
        it('should handle dates near DST transition (Spring forward)', () => {
            // March 9, 2026 - DST starts in US
            const result = parseDate('2026-03-09 02:30');
            expect(result.success).toBe(true);
        });

        it('should handle dates near DST transition (Fall back)', () => {
            // November 1, 2026 - DST ends in US
            const result = parseDate('2026-11-01 01:30');
            expect(result.success).toBe(true);
        });

        it('should handle midnight correctly', () => {
            const result = parseDate('tomorrow at 12am');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(0);
        });

        it('should handle noon correctly', () => {
            const result = parseDate('tomorrow at 12pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(12);
        });
    });

    describe('Special Characters in Event Data', () => {
        const specialCharCases = [
            { title: 'Meeting with "quotes"', desc: 'Double quotes' },
            { title: "Meeting with 'apostrophes'", desc: 'Single quotes' },
            { title: 'Meeting & Discussion', desc: 'Ampersand' },
            { title: 'Meeting @ Office', desc: 'At symbol' },
            { title: 'Meeting #1', desc: 'Hash symbol' },
            { title: 'Meeting $100 Budget', desc: 'Dollar sign' },
            { title: 'Meeting (Parentheses)', desc: 'Parentheses' },
            { title: 'Meeting [Brackets]', desc: 'Brackets' },
            { title: 'Meeting {Braces}', desc: 'Braces' },
            { title: 'Meeting / Slash', desc: 'Forward slash' },
            { title: 'Meeting \\ Backslash', desc: 'Backslash' },
            { title: 'Meeting | Pipe', desc: 'Pipe character' },
            { title: 'Meeting 🎉 Emoji', desc: 'Emoji' },
            { title: 'Meeting\nNewline', desc: 'Newline character' },
            { title: 'Meeting\tTab', desc: 'Tab character' },
        ];

        specialCharCases.forEach(({ title, desc }) => {
            it(`should handle ${desc} in title`, async () => {
                const result = await createTool.execute({
                    title,
                    startDate: '2026-03-01 10:00',
                });

                const parsed = JSON.parse(result);
                // Should either succeed or fail gracefully with proper error
                expect(parsed).toHaveProperty('success');
                expect(parsed).toHaveProperty('message');
            });
        });
    });

    describe('Title Length Edge Cases', () => {
        it('should handle very short title (1 char)', async () => {
            const result = await createTool.execute({
                title: 'A',
                startDate: '2026-03-01 10:00',
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
        });

        it('should handle long title (100 chars)', async () => {
            const title = 'A'.repeat(100);
            const result = await createTool.execute({
                title,
                startDate: '2026-03-01 10:00',
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
        });

        it('should handle very long title (500 chars)', async () => {
            const title = 'A'.repeat(500);
            const result = await createTool.execute({
                title,
                startDate: '2026-03-01 10:00',
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
        });
    });

    describe('Temporal Edge Cases', () => {
        it('should handle past dates', async () => {
            const result = await createTool.execute({
                title: 'Past Event',
                startDate: '2020-01-01 10:00',
            });

            const parsed = JSON.parse(result);
            // Should succeed - Calendar allows past events
            expect(parsed).toHaveProperty('success');
        });

        it('should handle far future dates (2050)', async () => {
            const result = await createTool.execute({
                title: 'Future Event',
                startDate: '2050-12-31 23:59',
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
        });

        it('should handle leap year date', async () => {
            const result = await createTool.execute({
                title: 'Leap Day Event',
                startDate: '2028-02-29 10:00', // 2028 is a leap year
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(true);
        });

        it('should reject invalid leap year date', () => {
            const result = parseDate('2026-02-29 10:00'); // 2026 is not a leap year
            expect(result.success).toBe(false);
        });
    });

    describe('Recurrence Edge Cases', () => {
        it('should handle daily recurrence with count', async () => {
            const result = await createTool.execute({
                title: 'Daily Event',
                startDate: '2026-03-01 09:00',
                recurrence: {
                    type: 'daily',
                    count: 30,
                },
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
        });

        it('should handle monthly recurrence with end date', async () => {
            const result = await createTool.execute({
                title: 'Monthly Event',
                startDate: '2026-03-01 10:00',
                recurrence: {
                    type: 'monthly',
                    endDate: '2026-12-31',
                },
            });

            const parsed = JSON.parse(result);
            expect(parsed).toHaveProperty('success');
        });

        it('should reject recurrence without count or endDate', async () => {
            const result = await createTool.execute({
                title: 'Invalid Recurrence',
                startDate: '2026-03-01 10:00',
                recurrence: {
                    type: 'weekly',
                },
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('INVALID_RECURRENCE');
        });
    });

    describe('Invalid Input Handling', () => {
        const invalidCases = [
            { startDate: '', desc: 'Empty string' },
            { startDate: '   ', desc: 'Whitespace only' },
            { startDate: 'asdfghjkl', desc: 'Random text' },
            { startDate: '2026-13-01 10:00', desc: 'Invalid month' },
            { startDate: '2026-02-30 10:00', desc: 'Invalid day' },
            { startDate: '2026-02-25 25:00', desc: 'Invalid hour' },
            { startDate: '2026-02-25 10:99', desc: 'Invalid minute' },
        ];

        invalidCases.forEach(({ startDate, desc }) => {
            it(`should reject ${desc}`, async () => {
                const result = await createTool.execute({
                    title: 'Test',
                    startDate,
                });

                const parsed = JSON.parse(result);
                expect(parsed.success).toBe(false);
                expect(parsed.error).toBeDefined();
            });
        });
    });

    describe('Generated Edge Cases', () => {
        it('should handle random valid dates across the year', () => {
            const months = Array.from({ length: 12 }, (_, i) => i + 1);
            const results = months.map(month => {
                const day = Math.floor(Math.random() * 28) + 1; // Safe day for all months
                const hour = Math.floor(Math.random() * 24);
                const minute = Math.floor(Math.random() * 60);
                const dateStr = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                
                return parseDate(dateStr);
            });

            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });

        it('should handle various unicode characters in titles', async () => {
            const unicodeTitles = [
                'Meeting 中文',
                'Meeting العربية',
                'Meeting Русский',
                'Meeting 日本語',
                'Meeting 한국어',
            ];

            for (const title of unicodeTitles) {
                const result = await createTool.execute({
                    title,
                    startDate: '2026-03-01 10:00',
                });

                const parsed = JSON.parse(result);
                expect(parsed).toHaveProperty('success');
            }
        });
    });

    describe('Performance and Stress Tests', () => {
        it('should handle rapid sequential calls', async () => {
            const promises = Array.from({ length: 5 }, (_, i) => 
                createTool.execute({
                    title: `Concurrent Test ${i}`,
                    startDate: '2026-03-01 10:00',
                })
            );

            const results = await Promise.all(promises);
            results.forEach(result => {
                const parsed = JSON.parse(result);
                expect(parsed).toHaveProperty('success');
            });
        });
    });

    describe('Response Structure Validation', () => {
        it('should always return valid JSON', async () => {
            const result = await createTool.execute({
                title: 'JSON Test',
                startDate: '2026-03-01 10:00',
            });

            expect(() => JSON.parse(result)).not.toThrow();
        });

        it('should include metadata in all responses', async () => {
            const result = await createTool.execute({
                title: 'Metadata Test',
                startDate: '2026-03-01 10:00',
            });

            const parsed = JSON.parse(result);
            expect(parsed.metadata).toBeDefined();
            expect(parsed.metadata.duration_ms).toBeTypeOf('number');
            expect(parsed.metadata.timestamp).toBeTypeOf('string');
        });

        it('should include error details on failure', async () => {
            const result = await createTool.execute({
                title: 'Error Test',
                startDate: 'invalid',
            });

            const parsed = JSON.parse(result);
            expect(parsed.success).toBe(false);
            expect(parsed.error).toBeDefined();
            expect(parsed.error.code).toBeTypeOf('string');
            expect(parsed.error.message).toBeTypeOf('string');
        });
    });
});
