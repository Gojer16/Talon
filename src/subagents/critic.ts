import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';

export class CriticSubagent extends Subagent {
    constructor(model: string, private router: ModelRouter) {
        super('critic', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const prompt = buildSubAgentPrompt('critic', task.description);
        const route = this.router.getProviderForTask('simple') || this.router.getDefaultProvider();
        if (!route) throw new Error('No provider available');

        const response = await route.provider.chat([{ role: 'user', content: prompt }], { model: this.model });
        const content = response.content || '{}';

        let data: any;
        try {
            data = JSON.parse(content);
        } catch {
            // LLM returned prose instead of JSON — use it as raw content
            data = { content, rawResponse: true, rating: 5, strengths: [], weaknesses: [], suggestions: [] };
        }

        return {
            summary: `Rating: ${data.rating || 5}/10`,
            data: { rating: data.rating || 5, strengths: data.strengths || [], weaknesses: data.weaknesses || [], suggestions: data.suggestions || [], approved: data.approved || false },
            confidence: data.rawResponse ? 0.5 : 0.85,
        };
    }
}
