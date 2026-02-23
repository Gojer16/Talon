// ─── Tasks Tools with Input Validation ─────────────────────────────
// Todo list management with priorities and completion
// Includes Zod validation, UUID-based IDs, and task limits

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const TASKS_FILE = path.join(process.env.HOME || '~', '.talon', 'workspace', 'tasks.json');
const MAX_TASKS = 500; // Maximum tasks before auto-archiving

interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'completed';
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
    completedAt?: string;
}

// Schemas for validation
const AddTaskSchema = z.object({
    title: z.string()
        .trim()
        .min(1, 'Title cannot be empty')
        .max(500, 'Title too long (max 500 chars)'),
    description: z.string()
        .trim()
        .max(5000, 'Description too long (max 5000 chars)')
        .optional(),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

const CompleteTaskSchema = z.object({
    id: z.string().trim().min(1, 'ID cannot be empty'),
});

const ListTasksSchema = z.object({
    status: z.enum(['pending', 'completed', 'all']).optional().default('pending'),
});

async function loadTasks(): Promise<Task[]> {
    try {
        const data = await fs.readFile(TASKS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveTasks(tasks: Task[]): Promise<void> {
    await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true });
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

/**
 * Generate a unique task ID using crypto.randomUUID() if available,
 * otherwise fallback to timestamp + random string
 */
function generateTaskId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for Node.js < 14.17 or without crypto
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(7);
}

/**
 * Auto-archive completed tasks when limit is exceeded
 */
async function autoArchiveCompletedTasks(tasks: Task[]): Promise<Task[]> {
    if (tasks.length <= MAX_TASKS) {
        return tasks;
    }

    const pending = tasks.filter(t => t.status === 'pending');
    const completed = tasks.filter(t => t.status === 'completed');

    // Keep only the most recent completed tasks to stay under limit
    const maxCompleted = MAX_TASKS - pending.length;
    if (maxCompleted <= 0) {
        // All tasks are pending, can't archive
        logger.warn({ taskCount: tasks.length, maxTasks: MAX_TASKS }, 'Task limit exceeded with all pending tasks');
        return tasks;
    }

    const sortedCompleted = completed.sort((a, b) => 
        new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
    );
    
    const archivedCount = completed.length - maxCompleted;
    const recentCompleted = sortedCompleted.slice(0, maxCompleted);

    logger.info({ archivedCount, remainingCompleted: recentCompleted.length }, 'Auto-archived completed tasks');

    return [...pending, ...recentCompleted];
}

export const tasksTools = [
    {
        name: 'tasks_add',
        description: 'Add a new task to the todo list',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Optional task description' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority' },
            },
            required: ['title'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            // Validate inputs
            let title: string;
            let description: string | undefined;
            let priority: 'low' | 'medium' | 'high';

            try {
                const parsed = AddTaskSchema.parse(args);
                title = parsed.title;
                description = parsed.description;
                priority = parsed.priority;
            } catch (error: any) {
                return `Error: ${error.errors?.[0]?.message || 'Invalid parameters'}`;
            }

            const tasks = await loadTasks();

            // Auto-archive if needed
            const archivedTasks = await autoArchiveCompletedTasks(tasks);
            if (archivedTasks.length !== tasks.length) {
                await saveTasks(archivedTasks);
            }

            // Check if we're at the limit
            if (archivedTasks.length >= MAX_TASKS) {
                return `Error: Task limit reached (${MAX_TASKS} tasks). Please complete or remove some tasks first.`;
            }

            const task: Task = {
                id: generateTaskId(),
                title,
                description,
                status: 'pending',
                priority,
                createdAt: new Date().toISOString(),
            };

            archivedTasks.push(task);
            await saveTasks(archivedTasks);

            logger.info({ taskId: task.id, title: task.title }, 'Task added');
            return `Task added: ${title} (ID: ${task.id})`;
        },
    },
    {
        name: 'tasks_list',
        description: 'List all tasks or filter by status',
        parameters: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['pending', 'completed', 'all'], description: 'Filter by status' },
            },
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            // Validate inputs
            let status: 'pending' | 'completed' | 'all';

            try {
                const parsed = ListTasksSchema.parse(args);
                status = parsed.status;
            } catch (error: any) {
                return `Error: ${error.errors?.[0]?.message || 'Invalid status parameter'}`;
            }

            const tasks = await loadTasks();
            const filtered = status === 'all'
                ? tasks
                : tasks.filter(t => t.status === status);

            if (filtered.length === 0) {
                return `No ${status} tasks found`;
            }

            const grouped = {
                high: filtered.filter(t => t.priority === 'high'),
                medium: filtered.filter(t => t.priority === 'medium'),
                low: filtered.filter(t => t.priority === 'low'),
            };

            let output = `${filtered.length} ${status} task(s):\n\n`;

            for (const [priority, taskList] of Object.entries(grouped)) {
                if (taskList.length === 0) continue;
                output += `**${priority.toUpperCase()} Priority:**\n`;
                for (const task of taskList) {
                    const checkbox = task.status === 'completed' ? '✓' : '○';
                    output += `${checkbox} [${task.id}] ${task.title}`;
                    if (task.description) output += ` - ${task.description}`;
                    output += '\n';
                }
                output += '\n';
            }

            return output;
        },
    },
    {
        name: 'tasks_complete',
        description: 'Mark a task as completed',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Task ID to complete' },
            },
            required: ['id'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            // Validate inputs
            let id: string;

            try {
                const parsed = CompleteTaskSchema.parse(args);
                id = parsed.id;
            } catch (error: any) {
                return `Error: ${error.errors?.[0]?.message || 'Invalid ID parameter'}`;
            }

            const tasks = await loadTasks();
            const task = tasks.find(t => t.id === id);
            
            if (!task) {
                return `Task not found: ${id}`;
            }

            if (task.status === 'completed') {
                return `Task already completed: ${task.title}`;
            }

            task.status = 'completed';
            task.completedAt = new Date().toISOString();

            await saveTasks(tasks);
            logger.info({ taskId: id, title: task.title }, 'Task completed');

            return `Task completed: ${task.title}`;
        },
    },
];
