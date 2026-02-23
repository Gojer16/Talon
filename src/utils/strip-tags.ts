// ─── Response Tag Stripper ────────────────────────────────────────
// OpenClaw-inspired multi-layer response processing
// Strips <think> blocks and extracts <final> content

/**
 * Strip <think> blocks and extract <final> content from AI responses.
 * Based on OpenClaw's block tag stripping logic.
 * 
 * @param text Raw AI response with tags
 * @returns Clean user-facing text
 */
export function stripBlockTags(text: string): string {
    if (!text) return '';

    // Step 1: Strip <think> blocks entirely (including content)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Step 2: Extract <final> content (remove tags, keep content)
    const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/i);
    if (finalMatch) {
        return finalMatch[1].trim();
    }

    // Step 3: Fallback - strip final tags but keep content
    text = text.replace(/<\/?final>/gi, '');

    // Step 4: Clean up extra whitespace
    return text.trim();
}

/**
 * Sanitize user-facing text by removing internal markers and tool artifacts.
 * 
 * @param text Text to sanitize
 * @returns Clean text
 */
export function sanitizeUserFacingText(text: string): string {
    if (!text) return '';

    // Remove tool call markers
    text = text.replace(/\[Tool Call:.*?\]/g, '');
    
    // Remove historical context markers
    text = text.replace(/\[Historical context:.*?\]/g, '');
    
    // Remove invoke blocks (if any leaked through)
    text = text.replace(/<invoke>[\s\S]*?<\/invoke>/gi, '');
    
    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
}

/**
 * Full response processing pipeline.
 * Combines tag stripping and sanitization.
 * 
 * @param rawResponse Raw AI response
 * @returns Clean, user-facing response
 */
export function processResponse(rawResponse: string): string {
    // Layer 1: Strip block tags
    let cleaned = stripBlockTags(rawResponse);
    
    // Layer 2: Sanitize artifacts
    cleaned = sanitizeUserFacingText(cleaned);
    
    return cleaned;
}
