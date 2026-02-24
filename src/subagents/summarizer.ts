import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';
import { logger } from '../utils/logger.js';

export class SummarizerSubagent extends Subagent {
    constructor(model: string, private router: ModelRouter) {
        super('summarizer', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const start = Date.now();
        logger.info({ type: this.type, model: this.model, taskLength: task.description.length }, 'Subagent executing');

        const prompt = buildSubAgentPrompt('summarizer', task.description);
        // Use cheap provider for summarization, fall back to default
        const route = this.router.getProviderForTask('simple') || this.router.getDefaultProvider();
        if (!route) throw new Error('No provider available');

        const llmPromise = route.provider.chat(
            [{ role: 'user', content: prompt }],
            { model: this.model },
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Subagent timed out after 30s')), 30_000),
        );
        const response = await Promise.race([llmPromise, timeoutPromise]);

        // Summarizer uses plain text (intentionally — no JSON parsing needed)
        const summary = response.content || '';
        const originalLength = task.context?.text?.length || 0;

        const elapsed = Date.now() - start;
        logger.info({ type: this.type, confidence: 0.9, responseTimeMs: elapsed }, 'Subagent completed');

        return {
            summary,
            data: { summary, keyPoints: summary.split('\n').filter((l: string) => l.trim().startsWith('-')), originalLength, summaryLength: summary.length },
            confidence: 0.9,
        };
    }
}
