// ─── Verify SOUL.md Integration ───────────────────────────────────
// Script to verify that SOUL.md updates are detected

import { MemoryManager } from '../memory/manager.js';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TALON_HOME = path.join(os.homedir(), '.talon');
const WORKSPACE_TEMPLATE = path.join(TALON_HOME, 'workspace');

async function main() {
    logger.info('🧪 Starting SOUL Verification');

    // 1. Load Config
    const config = await loadConfig(WORKSPACE_TEMPLATE);
    const soulPath = path.join(config.workspace.root.replace(/^~/, os.homedir()), 'SOUL.md');

    // Backup existing soul
    let backupSoul = '';
    if (fs.existsSync(soulPath)) {
        backupSoul = fs.readFileSync(soulPath, 'utf-8');
    }

    try {
        // 2. Initialize Manager
        const memoryManager = new MemoryManager({
            workspaceRoot: config.workspace.root,
        });

        // 3. Check Initial Load
        // We can't access private 'soul' property directly, but we can inspect buildContext output
        // Mock session
        const session: any = {
            id: 'test_session',
            messages: [],
            memorySummary: '',
            metadata: {},
            config: {},
        };

        let context = memoryManager.buildContext(session);
        const systemPrompt1 = context.find(m => m.role === 'system')?.content || '';

        logger.info({ length: systemPrompt1.length }, 'Initial System Prompt');

        // 4. Modify SOUL.md
        const newSoul = `You are VERIFICATION_BOT_${Date.now()}. You verify things.`;
        fs.writeFileSync(soulPath, newSoul, 'utf-8');
        logger.info('Modified SOUL.md');

        // 5. Reload
        memoryManager.reloadSoul();

        // 6. Verify Update
        context = memoryManager.buildContext(session);
        const systemPrompt2 = context.find(m => m.role === 'system')?.content || '';

        logger.info({ length: systemPrompt2.length }, 'Updated System Prompt');

        if (systemPrompt2.includes(newSoul)) {
            logger.info('✅ Verification Passed: SOUL.md update detected');
        } else {
            logger.error('❌ Verification Failed: New SOUL content not found in system prompt');
            logger.info({ expected: newSoul, actualStart: systemPrompt2.slice(0, 100) });
            process.exit(1);
        }

    } finally {
        // Restore backup
        if (backupSoul) {
            fs.writeFileSync(soulPath, backupSoul, 'utf-8');
            logger.info('Restored original SOUL.md');
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
