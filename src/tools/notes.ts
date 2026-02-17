import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const NOTES_DIR = path.join(process.env.HOME || '~', '.talon', 'workspace', 'notes');

async function ensureNotesDir(): Promise<void> {
    await fs.mkdir(NOTES_DIR, { recursive: true });
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
            
            const title = args.title as string;
            const content = args.content as string;
            const tags = (args.tags as string[]) || [];
            
            const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
            const filepath = path.join(NOTES_DIR, filename);
            
            const metadata = `---\ntitle: ${title}\ndate: ${new Date().toISOString()}\ntags: ${tags.join(', ')}\n---\n\n`;
            const fullContent = metadata + content;
            
            await fs.writeFile(filepath, fullContent, 'utf-8');
            logger.info({ title, filepath }, 'Note saved');
            
            return `Note saved: ${title} (${filename})`;
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
            
            const query = (args.query as string).toLowerCase();
            const tag = args.tag as string | undefined;
            
            const files = await fs.readdir(NOTES_DIR);
            const results: Array<{ title: string; file: string; excerpt: string }> = [];
            
            for (const file of files) {
                if (!file.endsWith('.md')) continue;
                
                const filepath = path.join(NOTES_DIR, file);
                const content = await fs.readFile(filepath, 'utf-8');
                
                if (tag && !content.includes(`tags: ${tag}`)) continue;
                
                if (content.toLowerCase().includes(query)) {
                    const lines = content.split('\n');
                    const titleLine = lines.find(l => l.startsWith('title:'));
                    const title = titleLine ? titleLine.replace('title:', '').trim() : file;
                    
                    const contentLines = lines.slice(lines.findIndex(l => l === '---', 1) + 1);
                    const excerpt = contentLines.join('\n').slice(0, 200);
                    
                    results.push({ title, file, excerpt });
                }
            }
            
            if (results.length === 0) return `No notes found matching "${query}"`;
            
            return `Found ${results.length} note(s):\n\n` + 
                   results.map(r => `**${r.title}** (${r.file})\n${r.excerpt}...`).join('\n\n');
        },
    },
];
