import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const TASKS_FILE = path.join(process.env.HOME || '~', '.talon', 'workspace', 'tasks.json');

interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'completed';
    priority?: 'low' | 'medium' | 'high';
    createdAt: string;
    completedAt?: string;
}

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
            const tasks = await loadTasks();
            
            const task: Task = {
                id: Date.now().toString(),
                title: args.title as string,
                description: args.description as string | undefined,
                status: 'pending',
                priority: (args.priority as 'low' | 'medium' | 'high') || 'medium',
                createdAt: new Date().toISOString(),
            };
            
            tasks.push(task);
            await saveTasks(tasks);
            
            logger.info({ taskId: task.id, title: task.title }, 'Task added');
            return `Task added: ${task.title} (ID: ${task.id})`;
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
            const tasks = await loadTasks();
            const status = (args.status as string) || 'pending';
            
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
            const tasks = await loadTasks();
            const id = args.id as string;
            
            const task = tasks.find(t => t.id === id);
            if (!task) return `Task not found: ${id}`;
            
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
