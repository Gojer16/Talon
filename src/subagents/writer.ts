import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';

export class WriterSubagent extends Subagent {
    constructor(
        model: string,
        private router: ModelRouter,
    ) {
        super('writer', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const prompt = buildSubAgentPrompt('writer', task.description);
        
        const response = await this.router.chat({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.choices[0]?.message?.content || '{}';
        const data = JSON.parse(content);

        return {
            summary: 'Content written',
            data: {
                content: data.content || '',
                format: data.format || 'text',
                wordCount: data.wordCount || 0,
            },
            confidence: 0.85,
        };
    }
}
