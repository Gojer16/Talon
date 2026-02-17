// ─── Example Skill ───────────────────────────────────────────────
// Demonstrates skill command registration in Talon CLI
// This skill auto-registers commands when imported

import type { Session } from '../../utils/types.js';
import type { CommandContext, CommandResult } from '../../channels/cli/commands.js';
import { registerSkillCommand } from '../../channels/cli/skill-commands.js';

// ─── Time Command ────────────────────────────────────────────────

/**
 * /time command - Shows current time and date
 */
async function timeCommandHandler(
    args: string, 
    session: Session, 
    context?: CommandContext
): Promise<CommandResult> {
    const now = new Date();
    
    return {
        type: 'info',
        message: [
            '🕒 Current Time',
            '──────────────',
            `  Date: ${now.toLocaleDateString()}`,
            `  Time: ${now.toLocaleTimeString()}`,
            `  Zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
            '',
            args ? `  Note: ${args}` : '',
        ].join('\n'),
    };
}

// ─── Echo Command ────────────────────────────────────────────────

/**
 * /echo command - Echoes back the provided text
 */
async function echoCommandHandler(
    args: string, 
    session: Session, 
    context?: CommandContext
): Promise<CommandResult> {
    if (!args.trim()) {
        return {
            type: 'error',
            message: 'Usage: /echo <text>',
        };
    }
    
    return {
        type: 'success',
        message: `📢 ${args}`,
    };
}

// ─── Calc Command ────────────────────────────────────────────────

/**
 * /calc command - Simple calculator (e.g., /calc 2+2)
 */
async function calcCommandHandler(
    args: string, 
    session: Session, 
    context?: CommandContext
): Promise<CommandResult> {
    if (!args.trim()) {
        return {
            type: 'error',
            message: [
                'Usage: /calc <expression>',
                'Examples:',
                '  /calc 2+2',
                '  /calc 10*5',
                '  /calc 100/4',
            ].join('\n'),
        };
    }
    
    try {
        // Simple safe evaluation (for demonstration only)
        // In a real skill, use a proper math parser
        const result = eval(args.replace(/[^-()\d/*+.]/g, ''));
        
        return {
            type: 'success',
            message: `🧮 ${args} = ${result}`,
        };
    } catch (error) {
        return {
            type: 'error',
            message: `Invalid expression: ${args}`,
        };
    }
}

// ─── Auto-registration ───────────────────────────────────────────

// Register commands immediately when this module is imported
// This is the simplest approach for skill command registration

registerSkillCommand(
    'example',
    'time',
    timeCommandHandler,
    'Show current time and date',
    {
        category: 'Utilities',
        examples: ['/time', '/time Caracas'],
    }
);

registerSkillCommand(
    'example',
    'echo',
    echoCommandHandler,
    'Echo back the provided text',
    {
        category: 'Utilities',
        examples: ['/echo Hello world!', '/echo Testing 123'],
        }
);

registerSkillCommand(
    'example',
    'calc',
    calcCommandHandler,
    'Simple calculator',
    {
        category: 'Utilities',
        examples: ['/calc 2+2', '/calc 10*5', '/calc 100/4'],
    }
);

console.log('[Skill] Example skill loaded with 3 commands: /time, /echo, /calc');

// Export handlers for testing or manual initialization
export {
    timeCommandHandler,
    echoCommandHandler,
    calcCommandHandler,
};