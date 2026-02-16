// ─── Logging via Pino ─────────────────────────────────────────────

import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const TALON_HOME = path.join(os.homedir(), '.talon');
const LOG_DIR = path.join(TALON_HOME, 'logs');

// Ensure log directory exists
function ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * Create the root Talon logger.
 * - In development (NODE_ENV !== 'production'): pretty-print to stdout
 * - In production: JSON to stdout + file
 */
export function createLogger(name: string = 'talon'): pino.Logger {
    const isDev = process.env.NODE_ENV !== 'production';
    const logLevel = process.env.LOG_LEVEL ?? 'info';

    // Silent mode - no output
    if (logLevel === 'silent') {
        return pino({ level: 'silent' });
    }

    if (isDev) {
        return pino({
            name,
            level: logLevel,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname',
                },
            },
        });
    }

    // Production: write to both stdout and log file
    ensureLogDir();
    const logFile = path.join(LOG_DIR, 'talon.log');

    return pino(
        {
            name,
            level: 'debug', // Lowest common denominator (streams filter higher)
        },
        pino.multistream([
            { level: 'warn', stream: process.stdout }, // Only warn/error to console
            { level: logLevel, stream: fs.createWriteStream(logFile, { flags: 'a' }) },
        ]),
    );
}

/** Global logger instance */
export const logger = createLogger();
