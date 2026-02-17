import { Subagent } from './base.js';
import type { SubagentTask, SubagentResult } from './types.js';
import { buildSubAgentPrompt } from '../agent/prompts.js';
import type { ModelRouter } from '../agent/router.js';

export class PlannerSubagent extends Subagent {
    constructor(
        model: string,
        private router: ModelRouter,
    ) {
        super('planner', model);
    }

    async execute(task: SubagentTask): Promise<SubagentResult> {
        const prompt = buildSubAgentPrompt('planner', task.description);
        
        const response = await this.router.chat({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.choices[0]?.message?.content || '{}';
        const data = JSON.parse(content);

        return {
            summary: data.goal || 'Plan created',
            data: {
                goal: data.goal || '',
                steps: data.steps || [],
                estimatedTime: data.estimatedTime || 'Unknown',
                risks: data.risks || [],
            },
            confidence: 0.8,
        };
    }
}
