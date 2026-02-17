import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';

export class ResearchSubagent extends Subagent {
    constructor(
        model: string,
        private router: ModelRouter,
    ) {
        super('research', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const prompt = buildSubAgentPrompt('research', task.description);
        
        const response = await this.router.chat({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.choices[0]?.message?.content || '{}';
        const data = JSON.parse(content);

        return {
            summary: data.keyInsights?.[0] || 'Research completed',
            data: {
                findings: data.findings || [],
                sources: data.findings?.map((f: any) => f.source).filter(Boolean) || [],
            },
            confidence: 0.8,
        };
    }
}
