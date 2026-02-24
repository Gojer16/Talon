import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const defaultAuthPath = path.join(os.homedir(), '.codex', 'auth.json');

interface CodexAuthFile {
    auth_mode?: string;
    tokens?: {
        access_token?: string;
    };
}

export function readCodexAccessToken(authPath: string = defaultAuthPath): string | null {
    if (!fs.existsSync(authPath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(authPath, 'utf-8');
        const parsed = JSON.parse(raw) as CodexAuthFile;
        const token = parsed.tokens?.access_token?.trim();
        return token ? token : null;
    } catch {
        return null;
    }
}

export function hasCodexChatGptAuth(authPath: string = defaultAuthPath): boolean {
    if (!fs.existsSync(authPath)) {
        return false;
    }

    try {
        const raw = fs.readFileSync(authPath, 'utf-8');
        const parsed = JSON.parse(raw) as CodexAuthFile;
        return parsed.auth_mode === 'chatgpt';
    } catch {
        return false;
    }
}
