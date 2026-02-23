// ─── Bulletproof Apple Reminders Tools ─────────────────────────────
// Zod-validated, structured JSON output, safe AppleScript execution

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
    formatSuccess,
    formatError,
    escapeAppleScript,
    createBaseString,
    safeExecAppleScript,
    checkPlatform,
    checkAppPermission,
    handleAppleScriptError,
    getPermissionRecoverySteps,
} from './apple-shared.js';

// ─── Zod Schemas ──────────────────────────────────────────────────

const AddReminderSchema = z.object({
    title: createBaseString(500, 'Reminder title is too long'),
    list: createBaseString(100, 'List name is too long').default('Talon'),
    dueDate: z.string().trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
        .optional(),
    priority: z.number().int().min(0).max(9).default(0),
}).strict();

const ListRemindersSchema = z.object({
    list: createBaseString(100, 'List name is too long').default('Talon'),
    completed: z.boolean().default(false),
}).strict();

const CompleteReminderSchema = z.object({
    title: createBaseString(500, 'Reminder title is too long'),
    list: createBaseString(100, 'List name is too long').default('Talon'),
}).strict();

// ─── Permission Check ─────────────────────────────────────────────

async function checkRemindersPermission() {
    return checkAppPermission('Reminders', `tell application "Reminders"
    set testList to name of list 1
    return testList
end tell`);
}

// ─── Tools ────────────────────────────────────────────────────────

export const appleRemindersTools = [
    {
        name: 'apple_reminders_add',
        description: 'Add a reminder to Apple Reminders app (macOS only)',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Reminder title' },
                list: { type: 'string', description: 'List name (default: "Talon")' },
                dueDate: { type: 'string', description: 'Due date in format "YYYY-MM-DD" (optional)' },
                priority: { type: 'number', description: 'Priority 0-9 (0=none, 1=high, 5=medium, 9=low)' },
            },
            required: ['title'],
        },
        async execute(rawArgs: Record<string, unknown>): Promise<string> {
            const startTime = Date.now();

            const platformErr = checkPlatform('Apple Reminders', startTime);
            if (platformErr) return platformErr;

            // Validate input
            const parsed = AddReminderSchema.safeParse(rawArgs);
            if (!parsed.success) {
                return formatError('VALIDATION_ERROR', 'Input validation failed', false, { errors: parsed.error.format() }, startTime);
            }

            const args = parsed.data;

            // Permission check
            const permCheck = await checkRemindersPermission();
            if (!permCheck.granted) {
                return formatError('PERMISSION_DENIED', 'Terminal does not have permission to access Reminders', true, {}, startTime, getPermissionRecoverySteps('Reminders'));
            }

            const title = escapeAppleScript(args.title);
            const listName = escapeAppleScript(args.list);

            let script = `tell application "Reminders"
    if not (exists list "${listName}") then
        make new list with properties {name:"${listName}"}
    end if
    set targetList to list "${listName}"
    set newReminder to make new reminder at end of targetList with properties {name:"${title}", priority:${args.priority}}`;

            if (args.dueDate) {
                // Parse YYYY-MM-DD to validate it's a real date
                const [year, month, day] = args.dueDate.split('-').map(Number);
                const testDate = new Date(year, month - 1, day);
                if (isNaN(testDate.getTime()) || testDate.getMonth() !== month - 1) {
                    return formatError('INVALID_DATE', `"${args.dueDate}" is not a valid date`, true, { dueDate: args.dueDate }, startTime);
                }
                script += `\n    set due date of newReminder to date "${month}/${day}/${year}"`;
            }

            script += `\n    return name of newReminder`;
            script += '\nend tell';

            try {
                const { stdout, stderr } = await safeExecAppleScript(script, 10000);

                const output = stdout.trim();
                logger.info({ title: args.title, list: listName, priority: args.priority }, 'Apple Reminder added');

                return formatSuccess({
                    message: `Reminder added: "${args.title}"`,
                    title: args.title,
                    list: listName,
                    priority: args.priority,
                    dueDate: args.dueDate || null,
                }, { applescriptOutput: output }, startTime);
            } catch (error) {
                return handleAppleScriptError(error, 'Reminders', { title: args.title, list: listName }, startTime);
            }
        },
    },
    {
        name: 'apple_reminders_list',
        description: 'List reminders from Apple Reminders app (macOS only)',
        parameters: {
            type: 'object',
            properties: {
                list: { type: 'string', description: 'List name (default: "Talon")' },
                completed: { type: 'boolean', description: 'Show completed reminders (default: false)' },
            },
        },
        async execute(rawArgs: Record<string, unknown>): Promise<string> {
            const startTime = Date.now();

            const platformErr = checkPlatform('Apple Reminders', startTime);
            if (platformErr) return platformErr;

            const parsed = ListRemindersSchema.safeParse(rawArgs);
            if (!parsed.success) {
                return formatError('VALIDATION_ERROR', 'Input validation failed', false, { errors: parsed.error.format() }, startTime);
            }

            const args = parsed.data;

            const permCheck = await checkRemindersPermission();
            if (!permCheck.granted) {
                return formatError('PERMISSION_DENIED', 'Terminal does not have permission to access Reminders', true, {}, startTime, getPermissionRecoverySteps('Reminders'));
            }

            const listName = escapeAppleScript(args.list);

            const script = `tell application "Reminders"
    if not (exists list "${listName}") then
        return "LIST_NOT_FOUND"
    end if
    set targetList to list "${listName}"
    set reminderList to {}
    repeat with aReminder in reminders of targetList
        set isCompleted to completed of aReminder
        if ${args.completed} or not isCompleted then
            set reminderName to name of aReminder
            set reminderStatus to ""
            if isCompleted then
                set reminderStatus to "[✓] "
            else
                set reminderStatus to "[ ] "
            end if
            set end of reminderList to reminderStatus & reminderName
        end if
    end repeat
    if (count of reminderList) = 0 then
        return "NO_REMINDERS"
    else
        return reminderList as text
    end if
end tell`;

            try {
                const { stdout } = await safeExecAppleScript(script, 10000);
                const output = stdout.trim();

                if (output === 'LIST_NOT_FOUND') {
                    return formatError('LIST_NOT_FOUND', `List "${args.list}" does not exist`, true, { list: listName }, startTime);
                }

                if (output === 'NO_REMINDERS') {
                    return formatSuccess({
                        reminders: [],
                        count: 0,
                        message: `No reminders found in "${args.list}"`,
                        list: listName,
                    }, {}, startTime);
                }

                // Parse the comma-separated reminder list
                const reminders = output.split(', ').map(item => {
                    const isComplete = item.startsWith('[✓]');
                    const name = item.replace(/^\[.\]\s*/, '').trim();
                    return { name, completed: isComplete };
                });

                return formatSuccess({
                    reminders,
                    count: reminders.length,
                    message: `Found ${reminders.length} reminder(s) in "${args.list}"`,
                    list: listName,
                    showingCompleted: args.completed,
                }, { applescriptOutput: output }, startTime);
            } catch (error) {
                return handleAppleScriptError(error, 'Reminders', { list: listName }, startTime);
            }
        },
    },
    {
        name: 'apple_reminders_complete',
        description: 'Mark a reminder as complete in Apple Reminders app (macOS only)',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Reminder title to complete' },
                list: { type: 'string', description: 'List name (default: "Talon")' },
            },
            required: ['title'],
        },
        async execute(rawArgs: Record<string, unknown>): Promise<string> {
            const startTime = Date.now();

            const platformErr = checkPlatform('Apple Reminders', startTime);
            if (platformErr) return platformErr;

            const parsed = CompleteReminderSchema.safeParse(rawArgs);
            if (!parsed.success) {
                return formatError('VALIDATION_ERROR', 'Input validation failed', false, { errors: parsed.error.format() }, startTime);
            }

            const args = parsed.data;

            const permCheck = await checkRemindersPermission();
            if (!permCheck.granted) {
                return formatError('PERMISSION_DENIED', 'Terminal does not have permission to access Reminders', true, {}, startTime, getPermissionRecoverySteps('Reminders'));
            }

            const title = escapeAppleScript(args.title);
            const listName = escapeAppleScript(args.list);

            const script = `tell application "Reminders"
    if not (exists list "${listName}") then
        return "LIST_NOT_FOUND"
    end if
    set targetList to list "${listName}"
    set found to false
    repeat with aReminder in reminders of targetList
        if name of aReminder is "${title}" then
            set completed of aReminder to true
            set found to true
            exit repeat
        end if
    end repeat
    if found then
        return "COMPLETED"
    else
        return "NOT_FOUND"
    end if
end tell`;

            try {
                const { stdout } = await safeExecAppleScript(script, 10000);
                const output = stdout.trim();

                if (output === 'LIST_NOT_FOUND') {
                    return formatError('LIST_NOT_FOUND', `List "${args.list}" does not exist`, true, { list: listName, title: args.title }, startTime);
                }

                if (output === 'NOT_FOUND') {
                    return formatError('REMINDER_NOT_FOUND', `Reminder "${args.title}" not found in list "${args.list}"`, true, {
                        list: listName,
                        title: args.title,
                        suggestion: 'Check the exact reminder title or list name',
                    }, startTime);
                }

                logger.info({ title: args.title, list: listName }, 'Apple Reminder completed');
                return formatSuccess({
                    message: `Reminder completed: "${args.title}"`,
                    title: args.title,
                    list: listName,
                }, { applescriptOutput: output }, startTime);
            } catch (error) {
                return handleAppleScriptError(error, 'Reminders', { title: args.title, list: listName }, startTime);
            }
        },
    },
];
