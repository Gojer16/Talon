/**
 * Generate descriptive slug from session messages.
 * Simplified version - full implementation would use LLM.
 */
export function generateSlug(messages: Array<{ role: string; content: string }>): string {
  // Find first user message
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) {
    return generateTimestampSlug();
  }

  // Extract first few words
  const words = firstUser.content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 5);

  if (words.length === 0) {
    return generateTimestampSlug();
  }

  return words.join('-');
}

/**
 * Generate timestamp-based slug as fallback.
 */
export function generateTimestampSlug(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return `session-${year}${month}${day}-${hour}${minute}`;
}
