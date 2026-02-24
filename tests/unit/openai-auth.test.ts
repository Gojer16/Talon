import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hasCodexChatGptAuth, readCodexAccessToken } from '@/cli/openai-auth.js';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs) {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
    tempDirs.length = 0;
});

describe('openai-auth helpers', () => {
    it('should read access token from Codex auth file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talon-openai-auth-'));
        tempDirs.push(dir);
        const authPath = path.join(dir, 'auth.json');

        fs.writeFileSync(authPath, JSON.stringify({
            auth_mode: 'chatgpt',
            tokens: { access_token: 'token-123' },
        }), 'utf-8');

        expect(readCodexAccessToken(authPath)).toBe('token-123');
    });

    it('should return null when token is missing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talon-openai-auth-'));
        tempDirs.push(dir);
        const authPath = path.join(dir, 'auth.json');

        fs.writeFileSync(authPath, JSON.stringify({ auth_mode: 'chatgpt', tokens: {} }), 'utf-8');
        expect(readCodexAccessToken(authPath)).toBeNull();
    });

    it('should detect chatgpt auth mode', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talon-openai-auth-'));
        tempDirs.push(dir);
        const authPath = path.join(dir, 'auth.json');

        fs.writeFileSync(authPath, JSON.stringify({ auth_mode: 'chatgpt' }), 'utf-8');
        expect(hasCodexChatGptAuth(authPath)).toBe(true);
    });
});
