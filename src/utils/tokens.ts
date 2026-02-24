// ─── Token Utilities ─────────────────────────────────────────────
// Shared helpers for token estimation and truncation

/**
 * Estimate tokens in a string.
 * Uses ~3 chars/token (conservative) — better for code, JSON, and non-English text.
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
}

/**
 * Truncate text to fit within a token budget.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 3;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n... (truncated)';
}
