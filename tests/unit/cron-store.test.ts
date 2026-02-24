// ─── Cron Store Tests ────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CronJobStore } from '../../src/cron/store.js';

describe('CronJobStore', () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'talon-cron-'));
    });

    afterEach(() => {
        if (fs.existsSync(workspaceRoot)) {
            fs.rmSync(workspaceRoot, { recursive: true, force: true });
        }
    });

    it('loads empty when cron.json missing', () => {
        const store = new CronJobStore(workspaceRoot);
        const jobs = store.loadJobs();
        expect(jobs).toEqual([]);
    });

    it('saves and reloads jobs', () => {
        const store = new CronJobStore(workspaceRoot);
        store.save([
            {
                id: 'job1',
                name: 'Test Job',
                schedule: '0 6 * * *',
                enabled: true,
                timeout: 30000,
                retryCount: 1,
                createdAt: Date.now(),
                runCount: 0,
                failCount: 0,
                actions: [{ type: 'message', text: 'hello' }],
            } as any,
        ]);

        const jobs = store.loadJobs();
        expect(jobs.length).toBe(1);
        expect(jobs[0].name).toBe('Test Job');
        expect(jobs[0].actions?.[0]?.type).toBe('message');
    });
});
