// ─── Cron Store ──────────────────────────────────────────────────
// Persist cron jobs in workspace cron.json

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import type { CronJob } from './index.js';
import { CronActionSchema } from './index.js';
import { writeFileAtomicSync } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

const CronJobFileSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    schedule: z.string().min(1),
    enabled: z.boolean().default(true),
    timeout: z.number().int().default(30000),
    retryCount: z.number().int().default(3),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.number().int().optional(),
    lastRun: z.number().int().optional(),
    nextRun: z.number().int().optional(),
    runCount: z.number().int().optional(),
    failCount: z.number().int().optional(),
    actions: z.array(CronActionSchema).min(1),
});

const CronFileSchema = z.object({
    version: z.number().int().default(1),
    jobs: z.array(CronJobFileSchema).default([]),
});

export type CronFile = z.infer<typeof CronFileSchema>;

function resolveWorkspacePath(workspaceRoot: string, file: string): string {
    return path.join(workspaceRoot.replace(/^~/, os.homedir()), file);
}

export class CronJobStore {
    private filePath: string;

    constructor(workspaceRoot: string) {
        this.filePath = resolveWorkspacePath(workspaceRoot, 'cron.json');
    }

    load(): CronFile {
        if (!fs.existsSync(this.filePath)) {
            return { version: 1, jobs: [] };
        }

        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            const result = CronFileSchema.safeParse(parsed);
            if (!result.success) {
                logger.warn({ error: result.error.message }, 'Invalid cron.json, using empty');
                return { version: 1, jobs: [] };
            }
            return result.data;
        } catch (error: any) {
            logger.warn({ error: error?.message }, 'Failed to read cron.json, using empty');
            return { version: 1, jobs: [] };
        }
    }

    loadJobs(): CronJob[] {
        const file = this.load();
        return file.jobs.map(job => ({
            ...job,
            command: undefined,
            args: [],
            createdAt: job.createdAt ?? Date.now(),
            runCount: job.runCount ?? 0,
            failCount: job.failCount ?? 0,
        }));
    }

    save(jobs: CronJob[]): void {
        const data: CronFile = {
            version: 1,
            jobs: jobs.map(job => ({
                id: job.id,
                name: job.name,
                schedule: job.schedule,
                enabled: job.enabled,
                timeout: job.timeout,
                retryCount: job.retryCount,
                metadata: job.metadata,
                createdAt: job.createdAt,
                lastRun: job.lastRun,
                nextRun: job.nextRun,
                runCount: job.runCount,
                failCount: job.failCount,
                actions: job.actions ?? [],
            })),
        };

        writeFileAtomicSync(this.filePath, JSON.stringify(data, null, 2));
    }
}
