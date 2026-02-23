import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';

export class ResearchSubagent extends Subagent {
    constructor(model: string, private router: ModelRouter) {
        super('research', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const prompt = buildSubAgentPrompt('research', task.description);
        const route = this.router.getProviderForTask('simple') || this.router.getDefaultProvider();
        if (!route) throw new Error('No provider available');

        const response = await route.provider.chat([{ role: 'user', content: prompt }], { model: this.model });
        const content = response.content || '{}';

        let data: any;
        try {
            data = JSON.parse(content);
        } catch {
            // LLM returned prose instead of JSON — use it as raw content
            data = { content, rawResponse: true, keyInsights: [content] };
        }

        return {
            summary: data.keyInsights?.[0] || 'Research completed',
            data: { findings: data.findings || [], sources: data.findings?.map((f: any) => f.source).filter(Boolean) || [] },
            confidence: data.rawResponse ? 0.5 : 0.8,
        };
    }
}
