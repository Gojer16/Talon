// ─── Verify Memory Compression ────────────────────────────────────
// Standalone script to test memory compression logic without running the full server.

import { Message } from '../utils/types.js';
import { MemoryManager } from '../memory/manager.js';
import { MemoryCompressor } from '../memory/compressor.js';
import { ModelRouter } from '../agent/router.js';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import os from 'os';

const TALON_HOME = path.join(os.homedir(), '.talon');
const WORKSPACE_TEMPLATE = path.join(TALON_HOME, 'workspace');

async function main() {
    logger.info('🧪 Starting Memory Compression Verification');

    // 1. Load Config
    const config = await loadConfig(WORKSPACE_TEMPLATE);

    // 2. Setup Components
    const modelRouter = new ModelRouter(config);
    const hasProviders = modelRouter.hasProviders();

    if (!hasProviders) {
        logger.warn('⚠️  No providers configured. Logic will be verified with MOCK compressor.');
    }

    const memoryManager = new MemoryManager({
        workspaceRoot: config.workspace.root,
        maxSummaryTokens: 200, // Small limit to force aggressive summarization
        keepRecentMessages: 5, // Keep only 5
    });

    const memoryCompressor = new MemoryCompressor(modelRouter);

    // MOCK COMPRESSOR logic if no providers (or even if there are, to test logic only)
    // Actually, let's strictly mock if no providers.
    if (!hasProviders) {
        memoryCompressor.compress = async (old, msgs, fmt) => {
            logger.info('🤖 Mocking LLM compression call...');
            return `MOCKED SUMMARY of ${msgs.length} messages. (Old summary len: ${old.length})`;
        };
    }

    // 3. Mock Session with many messages
    logger.info('📝 Generating 20 dummy messages...');
    const messages: Message[] = [];
    for (let i = 1; i <= 20; i++) {
        messages.push({
            id: `msg_${i}`,
            role: i % 2 === 0 ? 'assistant' : 'user',
            content: i % 2 === 0
                ? `Response ${i}: Here is some information about topic ${i}.`
                : `Question ${i}: Tell me about topic ${i}.`,
            timestamp: Date.now() + i * 1000,
        });
    }

    // Mock Session Object
    const session: any = {
        id: 'test_session',
        messages,
        memorySummary: '',
    };

    // 4. Verify Trigger
    // keepRecentMessages is 5. Total messages 20.
    // getMessagesForCompression should return 15 messages (20 - 5).
    // needsCompression should be true (20 > 5 * 2 = 10).

    const needsCompression = memoryManager.needsCompression(session);
    logger.info({ needsCompression }, 'Needs compression?');

    if (!needsCompression) {
        logger.error('❌ Should need compression but returned false');
        process.exit(1);
    }

    // 5. Run Compression
    logger.info('🔄 Running compression...');
    const toCompress = memoryManager.getMessagesForCompression(session);
    logger.info({ count: toCompress.length }, 'Messages to compress');

    if (toCompress.length !== 15) {
        logger.error({ expected: 15, actual: toCompress.length }, '❌ Incorrect number of messages to compress');
        process.exit(1);
    }

    const formatted = memoryManager.formatMessagesForCompression(toCompress);

    const newSummary = await memoryCompressor.compress(
        session.memorySummary,
        toCompress,
        () => formatted
    );

    logger.info({
        oldSummaryLen: session.memorySummary.length,
        newSummaryLen: newSummary.length,
        summary: newSummary
    }, 'Compression complete');

    // 6. Apply
    memoryManager.applyCompression(session, newSummary);

    logger.info({
        remainingMessages: session.messages.length,
        summary: session.memorySummary
    }, 'Session updated');

    // We expect 5 messages remaining + a non-empty summary
    if (session.messages.length === 5 && session.memorySummary.length > 0) {
        logger.info('✅ Verification Passed!');
    } else {
        logger.error('❌ Verification Failed: Session state not updated correctly');
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
