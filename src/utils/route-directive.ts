// ─── Route Directive Parser ───────────────────────────────────────
// Extracts <route>{...}</route> blocks from model responses

const ROUTE_TAG_REGEX = /<route>([\s\S]*?)<\/route>/i;
const ALLOWED_CHANNELS = new Set(['telegram', 'whatsapp', 'cli', 'webchat']);

const CHANNEL_ALIASES: Record<string, string> = {
    tg: 'telegram',
    telegram: 'telegram',
    wa: 'whatsapp',
    whatsapp: 'whatsapp',
    tui: 'cli',
    terminal: 'cli',
    cli: 'cli',
    web: 'webchat',
    webchat: 'webchat',
};

function normalizeChannels(raw: unknown): string[] {
    let values: string[] = [];

    if (Array.isArray(raw)) {
        values = raw.map(v => String(v));
    } else if (typeof raw === 'string') {
        values = raw.split(/[,\s]+/).filter(Boolean);
    }

    const normalized: string[] = [];
    for (const value of values) {
        const key = value.toLowerCase().trim();
        const mapped = CHANNEL_ALIASES[key] ?? key;
        if (ALLOWED_CHANNELS.has(mapped)) {
            normalized.push(mapped);
        }
    }

    return Array.from(new Set(normalized));
}

export function extractRouteDirective(raw: string): { channels: string[] | null; cleanedText: string } {
    if (!raw) return { channels: null, cleanedText: '' };

    const match = raw.match(ROUTE_TAG_REGEX);
    if (!match) {
        return { channels: null, cleanedText: raw };
    }

    const cleanedText = raw.replace(ROUTE_TAG_REGEX, '').trim();
    const payload = match[1]?.trim();
    if (!payload) {
        return { channels: null, cleanedText };
    }

    try {
        const data = JSON.parse(payload) as { channels?: unknown };
        const channels = normalizeChannels(data.channels);
        return { channels: channels.length > 0 ? channels : null, cleanedText };
    } catch {
        return { channels: null, cleanedText };
    }
}
