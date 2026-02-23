// ─── Web Tools ────────────────────────────────────────────────────
// Advanced web search with multiple provider support and automatic fallbacks
// Priority: DeepSeek (real API) -> OpenRouter -> Tavily -> DuckDuckGo
//
// Costs (approximate):
// - DeepSeek: ~$0.14/1M tokens (very cheap!)
// - OpenRouter: ~$0.50/1K requests via DeepSeek
// - Tavily: 100 searches/month free
// - DuckDuckGo: free but unreliable

import { JSDOM } from 'jsdom';
import { z } from 'zod';
import type { TalonConfig } from '../config/schema.js';
import type { ToolDefinition } from './registry.js';
import { logger } from '../utils/logger.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_CHARS = 50_000;

// ─── Input Validation Schemas ─────────────────────────────────────

const WebSearchSchema = z.object({
    query: z.string()
        .trim()
        .min(1, 'Query cannot be empty')
        .max(1000, 'Query too long (max 1000 chars)'),
});

const WebFetchSchema = z.object({
    url: z.string()
        .trim()
        .min(1, 'URL cannot be empty')
        .max(2048, 'URL too long (max 2048 chars)')
        .url('Invalid URL format')
        .refine(
            (url) => url.startsWith('http://') || url.startsWith('https://'),
            'URL must start with http:// or https://'
        ),
    maxChars: z.number().int().min(100).max(500000).optional().default(DEFAULT_MAX_CHARS),
}).passthrough();

interface SearchResult {
    title: string;
    url: string;
    description: string;
    published?: string;
}

interface SearchResponse {
    query: string;
    provider: string;
    results: SearchResult[];
    tookMs: number;
}

// ─── DeepSeek Search (Real API - https://api.deepseek.com) ─────────────

async function searchViaDeepSeek(query: string, config: TalonConfig): Promise<SearchResponse> {
    const start = Date.now();
    const searchConfig = config.tools.web?.search;
    
    // Get API key from config or env
    const apiKey = searchConfig?.apiKey ?? process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
        throw new Error('DeepSeek API key required. Set tools.web.search.apiKey in config or DEEPSEEK_API_KEY env var.');
    }

    // Use DeepSeek's real API to search
    const prompt = `Search the web for: "${query}"

Return a JSON array of up to 5 search results in this exact format:
[{"title": "Page Title", "url": "https://example.com", "description": "Brief description of the page content"}]

Only return valid JSON array, no other text or markdown.`;

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`DeepSeek API error (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '[]';

    let results: SearchResult[] = [];
    try {
        // Try to parse JSON
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            results = parsed.slice(0, 5).map((r: { title?: string; url?: string; description?: string }) => ({
                title: r.title ?? '',
                url: r.url ?? '',
                description: r.description ?? '',
            }));
        }
    } catch {
        // Fallback: extract URLs from text
        const urlRegex = /(https?:\/\/[^\s"')]+)/g;
        const matches = content.match(urlRegex);
        if (matches) {
            results = matches.slice(0, 5).map(url => ({
                title: url.replace(/^https?:\/\//, '').slice(0, 50),
                url,
                description: '',
            }));
        }
    }

    return { query, provider: 'deepseek', results, tookMs: Date.now() - start };
}

// ─── OpenRouter Search (Fallback) ───────────────────────────────────────

async function searchViaOpenRouter(query: string, config: TalonConfig): Promise<SearchResponse> {
    const start = Date.now();
    const searchConfig = config.tools.web?.search;
    
    const apiKey = searchConfig?.apiKey ?? process.env.OPENROUTER_API_KEY;
    const model = searchConfig?.model ?? 'deepseek/deepseek-chat';
    
    if (!apiKey) {
        throw new Error('OpenRouter API key required. Set tools.web.search.apiKey in config or OPENROUTER_API_KEY env var.');
    }

    const prompt = `Search the web for: "${query}"

Return a JSON array of up to 5 search results in this exact format:
[{"title": "Page Title", "url": "https://example.com", "description": "Brief description"}]

Only return valid JSON array, no other text.`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://talon.ai',
            'X-Title': 'Talon AI Assistant',
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '[]';

    let results: SearchResult[] = [];
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            results = parsed.slice(0, 5).map((r: { title?: string; url?: string; description?: string }) => ({
                title: r.title ?? '',
                url: r.url ?? '',
                description: r.description ?? '',
            }));
        }
    } catch {
        const urlRegex = /(https?:\/\/[^\s"')]+)/g;
        const matches = content.match(urlRegex);
        if (matches) {
            results = matches.slice(0, 5).map(url => ({
                title: url.replace(/^https?:\/\//, '').slice(0, 50),
                url,
                description: '',
            }));
        }
    }

    return { query, provider: 'openrouter', results, tookMs: Date.now() - start };
}

// ─── Tavily Search (Free tier) ───────────────────────────────────────

async function searchViaTavily(query: string): Promise<SearchResponse> {
    const start = Date.now();
    
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        throw new Error('Tavily API key required. Set TAVILY_API_KEY env var. Get free key at https://tavily.com');
    }

    const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query,
            api_key: apiKey,
            max_results: 5,
            include_answer: false,
            include_raw_content: false,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Tavily API error (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
    const results: SearchResult[] = (data.results ?? []).map(r => ({
        title: r.title ?? '',
        url: r.url ?? '',
        description: r.content ?? '',
    }));

    return { query, provider: 'tavily', results, tookMs: Date.now() - start };
}

// ─── DuckDuckGo Search (Free fallback) ───────────────────────────────

async function searchViaDuckDuckGo(query: string): Promise<SearchResponse> {
    const start = Date.now();
    
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
        throw new Error(`DuckDuckGo error (${res.status}): ${res.statusText}`);
    }

    const html = await res.text();
    const results: SearchResult[] = [];
    
    const resultRegex = /<div class="result__body"[^>]*>([\s\S]*?)<\/div>/g;
    const linkRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;
    
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
        const body = match[1];
        const linkMatch = linkRegex.exec(body);
        const snippetMatch = snippetRegex.exec(body);
        
        if (linkMatch) {
            let url = linkMatch[1];
            if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
                url = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] ?? '');
            }
            
            if (url && !url.startsWith('//duckduckgo.com')) {
                results.push({
                    title: linkMatch[2].replace(/<[^>]+>/g, '').trim(),
                    url,
                    description: snippetMatch 
                        ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() 
                        : '',
                });
            }
        }
    }

    return { query, provider: 'duckduckgo', results, tookMs: Date.now() - start };
}

// ─── Main Search Function with Fallbacks ─────────────────────────────

async function runWebSearch(query: string, config: TalonConfig): Promise<SearchResponse> {
    const provider: string = config.tools.web?.search?.provider ?? 'deepseek';

    const errors: string[] = [];

    // Try DeepSeek first (real API - cheapest!)
    if (provider === 'deepseek') {
        try {
            return await searchViaDeepSeek(query, config);
        } catch (err) {
            errors.push(`DeepSeek: ${err instanceof Error ? err.message : String(err)}`);
            logger.warn({ err: errors[0] }, 'DeepSeek search failed, trying OpenRouter');
        }
    }

    // Try OpenRouter (fallback)
    if (provider === 'openrouter' || provider === 'deepseek') {
        try {
            return await searchViaOpenRouter(query, config);
        } catch (err) {
            errors.push(`OpenRouter: ${err instanceof Error ? err.message : String(err)}`);
            logger.warn({ err: errors[1] }, 'OpenRouter search failed, trying Tavily');
        }
    }

    // Try Tavily (free tier)
    if (provider === 'tavily' || provider === 'openrouter' || provider === 'deepseek') {
        try {
            return await searchViaTavily(query);
        } catch (err) {
            errors.push(`Tavily: ${err instanceof Error ? err.message : String(err)}`);
            logger.warn({ err: errors[2] }, 'Tavily search failed, trying DuckDuckGo');
        }
    }
    
    // Fallback to DuckDuckGo (free, scraping)
    try {
        return await searchViaDuckDuckGo(query);
    } catch (err) {
        errors.push(`DuckDuckGo: ${err instanceof Error ? err.message : String(err)}`);
        throw new Error(`All search providers failed:\n${errors.join('\n')}`);
    }
}

// ─── Web Fetch (Readability) ────────────────────────────────────────

async function extractReadableContent(html: string, url: string): Promise<{ title?: string; text: string }> {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const title = doc.querySelector('title')?.textContent ?? doc.querySelector('h1')?.textContent ?? undefined;

    const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.sidebar', '.advertisement', '.ad', '.social', '.comments',
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    ];

    for (const sel of removeSelectors) {
        doc.querySelectorAll(sel).forEach((el: Element) => el.remove());
    }

    const article = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.querySelector('.content') ?? doc.body;
    const text = article?.textContent ?? '';
    const cleaned = text.replace(/\s+/g, ' ').trim();

    return { title, text: cleaned };
}

async function runWebFetch(urlString: string, maxChars: number): Promise<{
    url: string;
    status: number;
    title?: string;
    text: string;
    tookMs: number;
}> {
    const start = Date.now();

    let res: Response;
    try {
        res = await fetch(urlString, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });
    } catch (err) {
        throw new Error(`Failed to fetch ${urlString}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
        throw new Error(`Not HTML (${contentType}): cannot extract readable content`);
    }

    const html = await res.text();
    const { title, text } = await extractReadableContent(html, urlString);

    const truncated = text.length > maxChars
        ? text.slice(0, maxChars) + '\n\n... (truncated)'
        : text;

    return {
        url: urlString,
        status: res.status,
        title,
        text: truncated,
        tookMs: Date.now() - start,
    };
}

// ─── Tools Registration ─────────────────────────────────────────────

export function registerWebTools(config: TalonConfig): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    const searchEnabled = config.tools.web?.search?.enabled ?? true;
    const fetchEnabled = config.tools.web?.fetch?.enabled ?? true;

    if (searchEnabled) {
        tools.push({
            name: 'web_search',
            description: 
                'Search the web for information.\n\n' +
                'Providers (in order of priority):\n' +
                '1. DeepSeek (real API) - Very cheap, ~$0.14/1M tokens\n' +
                '2. OpenRouter - Cheap via DeepSeek/Grok\n' +
                '3. Tavily - Free tier (100/month)\n' +
                '4. DuckDuckGo - Free but unreliable\n\n' +
                'Set DEEPSEEK_API_KEY or OPENROUTER_API_KEY env vars.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query' },
                },
                required: ['query'],
            },
            execute: async (args) => {
                // Validate inputs
                let query: string;
                try {
                    const parsed = WebSearchSchema.parse(args);
                    query = parsed.query;
                } catch (error: any) {
                    return `Error: ${error.errors?.[0]?.message || 'Invalid parameters'}`;
                }

                logger.info({ query }, 'web_search');

                try {
                    const response = await runWebSearch(query, config);

                    let output = `**Search Results (${response.provider})**\n\n`;

                    if (response.results.length === 0) {
                        return 'No results found.';
                    }

                    for (const result of response.results) {
                        output += `### [${result.title}](${result.url})\n`;
                        if (result.description) {
                            output += `${result.description}\n`;
                        }
                        output += '\n';
                    }

                    output += `*Took ${response.tookMs}ms*`;
                    return output;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger.error({ err: msg }, 'web_search failed');
                    return `Error: ${msg}`;
                }
            },
        });
    }

    if (fetchEnabled) {
        tools.push({
            name: 'web_fetch',
            description: 'Fetch a URL and extract readable content. Returns the page title and main text content.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to fetch' },
                    maxChars: { type: 'number', description: `Max characters to return. Default: ${DEFAULT_MAX_CHARS}` },
                },
                required: ['url'],
            },
            execute: async (args) => {
                // Validate inputs
                let url: string;
                let maxChars: number;

                try {
                    const parsed = WebFetchSchema.parse(args);
                    url = parsed.url as string;
                    maxChars = parsed.maxChars as number;
                } catch (error: any) {
                    return `Error: ${error.errors?.[0]?.message || 'Invalid parameters'}`;
                }

                logger.info({ url, maxChars }, 'web_fetch');

                try {
                    const result = await runWebFetch(url, maxChars);

                    let output = `**${result.title ?? 'Untitled'}**\n`;
                    output += `Source: ${result.url}\n`;
                    output += `Status: ${result.status} | Took: ${result.tookMs}ms\n\n`;
                    output += result.text;

                    return output;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger.error({ err: msg }, 'web_fetch failed');
                    return `Error: ${msg}`;
                }
            },
        });
    }

    return tools;
}
