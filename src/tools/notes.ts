// ─── Notes Tools with Input Validation ─────────────────────────────
// Local note management with markdown and tags
// Includes Zod validation for all inputs

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const NOTES_DIR = path.join(process.env.HOME || '~', '.talon', 'workspace', 'notes');

// Schemas for validation
const SaveNoteSchema = z.object({
    title: z.string()
        .trim()
        .min(1, 'Title cannot be empty')
        .max(200, 'Title too long (max 200 chars)')
        .transform(title => title.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    content: z.string()
        .min(1, 'Content cannot be empty')
        .max(100000, 'Content too long (max 100KB)'),
    tags: z.array(z.string().trim().max(50, 'Tag too long')).optional().default([]),
});

const SearchNotesSchema = z.object({
    query: z.string()
        .trim()
        .min(1, 'Query cannot be empty')
        .max(500, 'Query too long'),
    tag: z.string().trim().max(50, 'Tag too long').optional(),
});

async function ensureNotesDir(): Promise<void> {
    await fs.mkdir(NOTES_DIR, { recursive: true });
}

/**
 * Validate that a filename is safe (no path traversal)
 */
function validateFilename(filename: string): { valid: boolean; error?: string } {
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return { valid: false, error: 'Invalid filename: path traversal not allowed' };
    }
    // Check for absolute path
    if (path.isAbsolute(filename)) {
        return { valid: false, error: 'Invalid filename: must be relative' };
    }
    return { valid: true };
}

export const notesTools = [
    {
        name: 'notes_save',
        description: 'Save a note to the knowledge base with title and content',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Note title (used as filename)' },
                content: { type: 'string', description: 'Note content in markdown format' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
            },
            required: ['title', 'content'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            await ensureNotesDir();

            // Validate inputs
            let title: string;
            let content: string;
            let tags: string[];
            let safeFilename: string;

            try {
                const parsed = SaveNoteSchema.parse(args);
                title = parsed.title;
                content = parsed.content;
                tags = parsed.tags;
                safeFilename = parsed.title + '.md';
            } catch (error: any) {
                return `Error: ${error.errors?.[0]?.message || 'Invalid parameters'}`;
            }

            // Validate filename safety
            const validation = validateFilename(safeFilename);
            if (!validation.valid) {
                return `Error: ${validation.error}`;
            }

            const filepath = path.join(NOTES_DIR, safeFilename);

            // Security: Ensure resolved path is within NOTES_DIR
            const resolvedPath = path.resolve(filepath);
            const resolvedNotesDir = path.resolve(NOTES_DIR);
            if (!resolvedPath.startsWith(resolvedNotesDir)) {
                logger.error({ filepath, resolvedPath, resolvedNotesDir }, 'Path traversal attempt blocked');
                return 'Error: Invalid file path';
            }

            const metadata = `---\ntitle: ${title}\ndate: ${new Date().toISOString()}\ntags: ${tags.join(', ')}\n---\n\n`;
            const fullContent = metadata + content;

            await fs.writeFile(filepath, fullContent, 'utf-8');
            logger.info({ title, filepath }, 'Note saved');

            return `Note saved: ${title} (${safeFilename})`;
        },
    },
    {
        name: 'notes_search',
        description: 'Search through notes by keyword, tag, or title',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query (searches in title and content)' },
                tag: { type: 'string', description: 'Filter by specific tag' },
            },
            required: ['query'],
        },
        async execute(args: Record<string, unknown>): Promise<string> {
            await ensureNotesDir();

            // Validate inputs
            let query: string;
            let tag: string | undefined;

            try {
                const parsed = SearchNotesSchema.parse(args);
                query = parsed.query.toLowerCase();
                tag = parsed.tag;
            } catch (error: any) {
                return `Error: ${error.errors?.[0]?.message || 'Invalid parameters'}`;
            }

            const files = await fs.readdir(NOTES_DIR);
            const results: Array<{ title: string; file: string; excerpt: string }> = [];

            for (const file of files) {
                if (!file.endsWith('.md')) continue;

                const filepath = path.join(NOTES_DIR, file);
                
                // Security: Ensure file is within NOTES_DIR
                const resolvedPath = path.resolve(filepath);
                const resolvedNotesDir = path.resolve(NOTES_DIR);
                if (!resolvedPath.startsWith(resolvedNotesDir)) {
                    continue; // Skip files outside notes directory
                }

                const content = await fs.readFile(filepath, 'utf-8');

                // Case-insensitive tag search
                if (tag && !content.toLowerCase().includes(`tags: ${tag.toLowerCase()}`)) {
                    continue;
                }

                if (content.toLowerCase().includes(query)) {
                    const lines = content.split('\n');
                    const titleLine = lines.find(l => l.startsWith('title:'));
                    const title = titleLine ? titleLine.replace('title:', '').trim() : file;

                    const contentStartIndex = lines.findIndex(l => l === '---', 1);
                    const contentLines = contentStartIndex >= 0 ? lines.slice(contentStartIndex + 1) : lines;
                    const excerpt = contentLines.join('\n').slice(0, 200);

                    results.push({ title, file, excerpt });
                }
            }

            if (results.length === 0) {
                return `No notes found matching "${query}"${tag ? ` with tag "${tag}"` : ''}`;
            }

            return `Found ${results.length} note(s):\n\n` +
                   results.map(r => `**${r.title}** (${r.file})\n${r.excerpt}...`).join('\n\n');
        },
    },
];
