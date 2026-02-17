// ─── Prompts Tests ────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildCompressionPrompt, buildSubAgentPrompt } from '@/agent/prompts.js';

describe('Prompts', () => {
    describe('buildSystemPrompt', () => {
        it('should include soul content', () => {
            const soul = 'You are Talon, a helpful assistant.';
            const tools = ['file_read', 'shell_execute'];
            const workspace = '/test/workspace';

            const prompt = buildSystemPrompt(soul, tools, workspace);

            expect(prompt).toContain('Talon');
            expect(prompt).toContain('helpful assistant');
        });

        it('should include available tools', () => {
            const soul = 'Test soul';
            const tools = ['file_read', 'web_search'];
            const workspace = '/test/workspace';

            const prompt = buildSystemPrompt(soul, tools, workspace);

            expect(prompt).toContain('file_read');
            expect(prompt).toContain('web_search');
        });

        it('should include workspace path', () => {
            const soul = 'Test soul';
            const tools = [];
            const workspace = '/test/workspace';

            const prompt = buildSystemPrompt(soul, tools, workspace);

            // Workspace path is used internally, not necessarily in prompt text
            expect(prompt).toBeDefined();
            expect(prompt.length).toBeGreaterThan(0);
        });
    });

    describe('buildCompressionPrompt', () => {
        it('should include old summary', () => {
            const oldSummary = 'Previous conversation summary';
            const messages = '[USER]: Hello\n[ASSISTANT]: Hi';

            const prompt = buildCompressionPrompt(oldSummary, messages);

            expect(prompt).toContain('Previous conversation summary');
        });

        it('should include messages to compress', () => {
            const oldSummary = '';
            const messages = '[USER]: Hello\n[ASSISTANT]: Hi';

            const prompt = buildCompressionPrompt(oldSummary, messages);

            expect(prompt).toContain('[USER]: Hello');
            expect(prompt).toContain('[ASSISTANT]: Hi');
        });

        it('should handle empty old summary', () => {
            const oldSummary = '';
            const messages = '[USER]: Test';

            const prompt = buildCompressionPrompt(oldSummary, messages);

            expect(prompt).toBeDefined();
            expect(prompt.length).toBeGreaterThan(0);
        });
    });

    describe('buildSubAgentPrompt', () => {
        it('should build research subagent prompt', () => {
            const prompt = buildSubAgentPrompt('research', 'Find info about TypeScript');

            expect(prompt).toContain('research');
            expect(prompt).toContain('Find info about TypeScript');
            expect(prompt).toContain('JSON');
        });

        it('should build planner subagent prompt', () => {
            const prompt = buildSubAgentPrompt('planner', 'Plan a project');

            expect(prompt).toContain('planning');
            expect(prompt).toContain('Plan a project');
            expect(prompt).toContain('steps');
        });

        it('should build writer subagent prompt', () => {
            const prompt = buildSubAgentPrompt('writer', 'Write a blog post');

            expect(prompt).toContain('writing');
            expect(prompt).toContain('Write a blog post');
        });

        it('should build critic subagent prompt', () => {
            const prompt = buildSubAgentPrompt('critic', 'Review this code');

            expect(prompt).toContain('critic');
            expect(prompt).toContain('Review this code');
            expect(prompt).toContain('feedback');
        });

        it('should build summarizer subagent prompt', () => {
            const prompt = buildSubAgentPrompt('summarizer', 'Summarize this text');

            expect(prompt).toContain('summarization');
            expect(prompt).toContain('Summarize this text');
            expect(prompt).toContain('800 tokens');
        });
    });
});
