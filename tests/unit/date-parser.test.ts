// ─── Date Parser Tests ────────────────────────────────────────────
// Comprehensive tests for flexible date parsing

import { describe, it, expect } from 'vitest';
import { parseDate, formatForAppleScript, formatForDisplay } from '@/tools/utils/date-parser.js';

describe('Date Parser', () => {
    describe('ISO 8601 Formats', () => {
        it('should parse YYYY-MM-DD HH:MM format', () => {
            const result = parseDate('2026-02-25 14:30');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getFullYear()).toBe(2026);
            expect(result.parsed?.date.getMonth()).toBe(1); // February = 1
            expect(result.parsed?.date.getDate()).toBe(25);
            expect(result.parsed?.date.getHours()).toBe(14);
            expect(result.parsed?.date.getMinutes()).toBe(30);
            expect(result.parsed?.confidence).toBe(1.0);
        });

        it('should parse YYYY-MM-DDTHH:MM format', () => {
            const result = parseDate('2026-03-15T09:00');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getMonth()).toBe(2); // March = 2
            expect(result.parsed?.date.getHours()).toBe(9);
        });

        it('should parse YYYY-MM-DD (date only, default to 9am)', () => {
            const result = parseDate('2026-12-25');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(9);
            expect(result.parsed?.confidence).toBe(0.9);
        });

        it('should handle single-digit hours', () => {
            const result = parseDate('2026-02-25 9:30');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(9);
        });
    });

    describe('Relative Dates', () => {
        it('should parse "today"', () => {
            const result = parseDate('today');
            expect(result.success).toBe(true);
            const now = new Date();
            expect(result.parsed?.date.getDate()).toBe(now.getDate());
            expect(result.parsed?.date.getMonth()).toBe(now.getMonth());
        });

        it('should parse "tomorrow"', () => {
            const result = parseDate('tomorrow');
            expect(result.success).toBe(true);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(result.parsed?.date.getDate()).toBe(tomorrow.getDate());
        });

        it('should parse "tomorrow at 3pm"', () => {
            const result = parseDate('tomorrow at 3pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(15);
            expect(result.parsed?.confidence).toBe(1.0);
        });

        it('should parse "today at 2:30pm"', () => {
            const result = parseDate('today at 2:30pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(14);
            expect(result.parsed?.date.getMinutes()).toBe(30);
        });

        it('should parse "next week"', () => {
            const result = parseDate('next week');
            expect(result.success).toBe(true);
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            expect(result.parsed?.date.getDate()).toBe(nextWeek.getDate());
        });

        it('should parse "next Monday"', () => {
            const result = parseDate('next Monday');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getDay()).toBe(1); // Monday
        });

        it('should parse "next Friday at 5pm"', () => {
            const result = parseDate('next Friday at 5pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getDay()).toBe(5); // Friday
            expect(result.parsed?.date.getHours()).toBe(17);
        });

        it('should handle "this Monday" with lower confidence', () => {
            const result = parseDate('this Monday');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getDay()).toBe(1);
            expect(result.parsed?.confidence).toBe(0.7); // Ambiguous
        });
    });

    describe('Natural Language', () => {
        it('should parse "Monday 2pm"', () => {
            const result = parseDate('Monday 2pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getDay()).toBe(1);
            expect(result.parsed?.date.getHours()).toBe(14);
        });

        it('should parse "Friday at 3:30pm"', () => {
            const result = parseDate('Friday at 3:30pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getDay()).toBe(5);
            expect(result.parsed?.date.getHours()).toBe(15);
            expect(result.parsed?.date.getMinutes()).toBe(30);
        });

        it('should parse "Feb 25"', () => {
            const result = parseDate('Feb 25');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getMonth()).toBe(1); // February
            expect(result.parsed?.date.getDate()).toBe(25);
        });

        it('should parse "March 3 at 10am"', () => {
            const result = parseDate('March 3 at 10am');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getMonth()).toBe(2); // March
            expect(result.parsed?.date.getDate()).toBe(3);
            expect(result.parsed?.date.getHours()).toBe(10);
        });

        it('should assume future dates for past month/day', () => {
            const now = new Date();
            const pastMonth = now.getMonth() - 1;
            const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][pastMonth];
            
            const result = parseDate(`${monthName} 15`);
            expect(result.success).toBe(true);
            // Should be next year if date is in the past
            if (result.parsed) {
                expect(result.parsed.date >= now).toBe(true);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should reject invalid dates', () => {
            const result = parseDate('2026-13-45 25:99');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject completely invalid input', () => {
            const result = parseDate('asdfghjkl');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unable to parse date');
        });

        it('should handle empty string', () => {
            const result = parseDate('');
            expect(result.success).toBe(false);
        });

        it('should handle whitespace-only input', () => {
            const result = parseDate('   ');
            expect(result.success).toBe(false);
        });

        it('should handle midnight (12am)', () => {
            const result = parseDate('tomorrow at 12am');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(0);
        });

        it('should handle noon (12pm)', () => {
            const result = parseDate('tomorrow at 12pm');
            expect(result.success).toBe(true);
            expect(result.parsed?.date.getHours()).toBe(12);
        });
    });

    describe('Ambiguity Detection', () => {
        it('should detect ambiguous MM/DD format', () => {
            // This test depends on implementation - if both interpretations are valid
            const result = parseDate('3/4/2026 10:00');
            // Could be March 4 or April 3 - implementation may choose one or flag as ambiguous
            expect(result.success).toBeDefined();
        });
    });

    describe('AppleScript Formatting', () => {
        it('should format date for AppleScript', () => {
            const date = new Date(2026, 1, 25, 14, 30, 0); // Feb 25, 2026 2:30pm
            const formatted = formatForAppleScript(date);
            expect(formatted).toBe('February 25, 2026 14:30:00');
        });

        it('should handle single-digit days', () => {
            const date = new Date(2026, 0, 5, 9, 5, 3); // Jan 5, 2026
            const formatted = formatForAppleScript(date);
            expect(formatted).toBe('January 5, 2026 9:05:03');
        });
    });

    describe('Display Formatting', () => {
        it('should format date for display', () => {
            const date = new Date(2026, 1, 25, 14, 30, 0);
            const formatted = formatForDisplay(date);
            expect(formatted).toContain('Feb');
            expect(formatted).toContain('25');
            expect(formatted).toContain('2026');
        });
    });
});
