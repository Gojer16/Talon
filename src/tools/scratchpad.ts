// Scratchpad management tool for multi-step task tracking

import { z } from 'zod';

const ScratchpadActionSchema = z.enum(['add_visited', 'add_collected', 'add_pending', 'remove_pending', 'set_progress', 'clear']);

const ScratchpadBaseSchema = z.object({
    action: ScratchpadActionSchema,
    value: z.string().optional(),
    data: z.record(z.string(), z.any()).optional(),
});

export function createScratchpadTool() {
    return {
        name: 'scratchpad_update',
        description: 'Update scratchpad for tracking multi-step task progress. Use this to track visited items, collected results, and pending work.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add_visited', 'add_collected', 'add_pending', 'remove_pending', 'set_progress', 'clear'],
                    description: 'Action to perform on scratchpad'
                },
                value: {
                    type: 'string',
                    description: 'Value to add/remove (for add_visited, add_pending, remove_pending)'
                },
                data: {
                    type: 'object',
                    description: 'Data to add (for add_collected) or progress state (for set_progress)'
                },
            },
            required: ['action'],
        },
        async execute(args: Record<string, unknown>, session?: any): Promise<string> {
            // Validate action first
            const actionResult = ScratchpadActionSchema.safeParse(args.action);
            if (!actionResult.success) {
                return `Error: Invalid action. Must be one of: add_visited, add_collected, add_pending, remove_pending, set_progress, clear`;
            }

            // Validate full schema
            const validationResult = ScratchpadBaseSchema.safeParse(args);
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                return `Error: Validation failed - ${errors}`;
            }

            const { action, value, data } = validationResult.data;

            if (!session) {
                return 'Error: Session context required for scratchpad operations';
            }

            // Initialize scratchpad if it doesn't exist
            if (!session.scratchpad) {
                session.scratchpad = {
                    visited: [],
                    collected: [],
                    pending: [],
                    progress: {},
                };
            }

            switch (action) {
                case 'add_visited':
                    if (!value) return 'Error: value required for add_visited';
                    if (!session.scratchpad.visited.includes(value)) {
                        session.scratchpad.visited.push(value);
                    }
                    return `Added "${value}" to visited list. Total visited: ${session.scratchpad.visited.length}`;

                case 'add_collected':
                    if (!data) return 'Error: data required for add_collected';
                    session.scratchpad.collected.push(data);
                    return `Added item to collected results. Total collected: ${session.scratchpad.collected.length}`;

                case 'add_pending':
                    if (!value) return 'Error: value required for add_pending';
                    if (!session.scratchpad.pending.includes(value)) {
                        session.scratchpad.pending.push(value);
                    }
                    return `Added "${value}" to pending list. Total pending: ${session.scratchpad.pending.length}`;

                case 'remove_pending':
                    if (!value) return 'Error: value required for remove_pending';
                    const index = session.scratchpad.pending.indexOf(value);
                    if (index > -1) {
                        session.scratchpad.pending.splice(index, 1);
                        return `Removed "${value}" from pending list. Remaining: ${session.scratchpad.pending.length}`;
                    }
                    return `"${value}" not found in pending list`;

                case 'set_progress':
                    if (!data) return 'Error: data required for set_progress';
                    session.scratchpad.progress = { ...session.scratchpad.progress, ...data };
                    return `Updated progress state: ${JSON.stringify(session.scratchpad.progress)}`;

                case 'clear':
                    session.scratchpad = {
                        visited: [],
                        collected: [],
                        pending: [],
                        progress: {},
                    };
                    return 'Scratchpad cleared';

                default:
                    return `Error: Unknown action "${action}"`;
            }
        },
    };
}
