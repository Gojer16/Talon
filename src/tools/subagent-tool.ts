import { z } from 'zod';
import type { SubagentRegistry } from '../subagents/index.js';
import type { SubagentType } from '../subagents/types.js';

const SubagentTaskSchema = z.object({
    type: z.enum(['research', 'writer', 'planner', 'critic', 'summarizer']),
    description: z.string().min(1, 'Description cannot be empty'),
    context: z.record(z.string(), z.any()).optional(),
});

export function createSubagentTool(registry: SubagentRegistry) {
    return {
        name: 'delegate_to_subagent',
        description: 'Delegate a specialized task to a subagent (research, writer, planner, critic, summarizer)',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['research', 'writer', 'planner', 'critic', 'summarizer'], description: 'Type of subagent to use' },
                description: { type: 'string', description: 'Task description for the subagent' },
                context: { type: 'object', description: 'Optional context data for the subagent' },
            },
            required: ['type', 'description'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            // Validate input parameters
            const validationResult = SubagentTaskSchema.safeParse(args);
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                return JSON.stringify({
                    success: false,
                    error: `Invalid subagent task - ${errors}`,
                });
            }

            const { type, description, context } = validationResult.data;

            try {
                const result = await registry.execute({
                    type,
                    description,
                    context,
                });
                return JSON.stringify({ success: true, summary: result.summary, data: result.data, confidence: result.confidence }, null, 2);
            } catch (err) {
                return JSON.stringify({
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        },
    };
}
