// ─── Cron Executor ───────────────────────────────────────────────
// Executes cron job actions via agent/tools and sends to channels

import type { AgentLoop } from '../agent/loop.js';
import type { SessionManager } from '../gateway/sessions.js';
import type { EventBus } from '../gateway/events.js';
import type { TalonConfig } from '../config/schema.js';
import type { CronAction, CronJob } from './index.js';
import type { Session } from '../utils/types.js';
import { logger } from '../utils/logger.js';
import { loadProfile } from '../memory/profile.js';
import { extractRouteDirective } from '../utils/route-directive.js';

function createSyntheticSession(id: string, model: string): Session {
    return {
        id,
        senderId: 'cron',
        channel: 'cron',
        state: 'active',
        messages: [],
        memorySummary: '',
        metadata: {
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            messageCount: 0,
            model,
        },
        config: {},
    };
}

function resolveDefaultChannel(config: TalonConfig, workspaceRoot: string): string {
    const profile = loadProfile(workspaceRoot);
    return profile?.channels?.default ?? 'cli';
}

function resolveSenderIdForChannel(config: TalonConfig, channel: string, fallback: string): string | null {
    if (channel === 'cli' || channel === 'tui') return fallback;
    if (channel === 'telegram') return config.channels.telegram.allowedUsers?.[0] ?? null;
    if (channel === 'whatsapp') return config.channels.whatsapp.allowedUsers?.[0] ?? null;
    if (channel === 'webchat') return null;
    return null;
}

async function sendToChannel(
    sessionManager: SessionManager,
    eventBus: EventBus,
    config: TalonConfig,
    channel: string,
    text: string,
): Promise<void> {
    const normalized = channel === 'tui' ? 'cli' : channel;
    const senderId = resolveSenderIdForChannel(config, normalized, 'cron');
    if (!senderId) {
        logger.warn({ channel: normalized }, 'No default recipient for channel');
        return;
    }

    const existing = sessionManager.getSessionBySender(senderId);
    const session = existing?.channel === normalized
        ? existing
        : sessionManager.createSession(senderId, normalized, 'Cron');

    eventBus.emit('message.outbound', {
        message: {
            sessionId: session.id,
            text,
        },
        sessionId: session.id,
    });
}

async function runAgentAction(
    job: CronJob,
    action: Extract<CronAction, { type: 'agent' }>,
    agentLoop: AgentLoop,
    config: TalonConfig,
): Promise<string> {
    const session = createSyntheticSession(`cron_${job.id}_${Date.now()}`, config.agent.model);

    const prompt = `You are executing a scheduled job.\n\nTask:\n${action.prompt}\n\nIf tools are needed, use them. Return only the final message to send to the user.`;
    session.messages.push({
        id: `msg_${Date.now().toString(36)}`,
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
    });

    let finalText = '';
    for await (const chunk of agentLoop.run(session)) {
        if (chunk.type === 'done') {
            const last = session.messages.filter(m => m.role === 'assistant').pop();
            finalText = last?.content ?? '';
        }
    }

    const { cleanedText } = extractRouteDirective(finalText);
    return cleanedText.trim();
}

async function runToolAction(
    action: Extract<CronAction, { type: 'tool' }>,
    agentLoop: AgentLoop,
    config: TalonConfig,
): Promise<string> {
    const session = createSyntheticSession(`cron_tool_${Date.now()}`, config.agent.model);
    const output = await agentLoop.executeToolWithSession(action.tool, action.args ?? {}, session);
    return output;
}

export function createCronExecutor(
    agentLoop: AgentLoop,
    sessionManager: SessionManager,
    eventBus: EventBus,
    config: TalonConfig,
): (job: CronJob) => Promise<void> {
    return async (job: CronJob) => {
        if (!job.actions || job.actions.length === 0) {
            logger.warn({ jobId: job.id }, 'Cron job has no actions');
            return;
        }

        const defaultChannel = resolveDefaultChannel(config, config.workspace.root);

        for (const action of job.actions) {
            const targetChannel = action.channel ?? defaultChannel;

            if (action.type === 'message') {
                await sendToChannel(sessionManager, eventBus, config, targetChannel, action.text);
                continue;
            }

            if (action.type === 'tool') {
                const output = await runToolAction(action, agentLoop, config);
                if (action.sendOutput) {
                    await sendToChannel(sessionManager, eventBus, config, targetChannel, output);
                }
                continue;
            }

            if (action.type === 'agent') {
                const text = await runAgentAction(job, action, agentLoop, config);
                if (text.length > 0) {
                    await sendToChannel(sessionManager, eventBus, config, targetChannel, text);
                }
                continue;
            }
        }
    };
}
