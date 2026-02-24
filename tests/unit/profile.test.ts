// ─── Profile Tests ───────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ProfileSchema, buildProfileSummary } from '../../src/memory/profile.js';

describe('Profile', () => {
    it('accepts valid profile', () => {
        const profile = {
            name: 'Orlando',
            preferredName: 'Gojer',
            timezone: 'America/New_York',
            language: 'en',
            tone: 'casual',
            workingHours: {
                mon: '09:00-18:00',
                tue: '09:00-18:00',
            },
            preferredTools: {
                notes: 'Obsidian',
            },
            channels: {
                default: 'cli',
                enabled: ['cli', 'telegram'],
            },
        };

        const result = ProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
    });

    it('rejects empty required fields', () => {
        const profile = {
            name: '',
            timezone: '',
        };

        const result = ProfileSchema.safeParse(profile);
        expect(result.success).toBe(false);
    });

    it('builds a compact summary', () => {
        const profile = {
            name: 'Orlando',
            preferredName: 'Bober',
            timezone: 'America/New_York',
            preferredTools: { notes: 'Obsidian' },
            channels: { default: 'telegram' },
        };

        const summary = buildProfileSummary(profile as any);
        expect(summary).toContain('Name: Orlando');
        expect(summary).toContain('Preferred name: Bober');
        expect(summary).toContain('Timezone: America/New_York');
        expect(summary).toContain('Preferred tools: notes: Obsidian');
        expect(summary).toContain('Default channel: telegram');
    });
});
