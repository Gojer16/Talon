import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';

export class SummarizerSubagent extends Subagent {
    constructor(
        model: string,
        private router: ModelRouter,
    ) {
        super('summarizer', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const prompt = buildSubAgentPrompt('summarizer', task.description);
        
        const response = await this.router.chat({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
        });

        const summary = response.choices[0]?.message?.content || '';
        const originalLength = task.context?.text?.length || 0;

        return {
            summary,
            data: {
                summary,
                keyPoints: summary.split('\n').filter(l => l.trim().startsWith('-')),
                originalLength,
                summaryLength: summary.length,
            },
            confidence: 0.9,
        };
    }
}
