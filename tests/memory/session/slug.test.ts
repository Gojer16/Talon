import { describe, it, expect } from 'vitest';
import { generateSlug, generateTimestampSlug } from '../../../src/memory/session/slug.js';

describe('Slug Generator', () => {
  it('should generate slug from first user message', () => {
    const messages = [
      { role: 'user', content: 'How do I install Node.js?' },
      { role: 'assistant', content: 'Here are the steps...' },
    ];

    const slug = generateSlug(messages);

    expect(slug).toBe('how-do-i-install-nodejs');
  });

  it('should handle special characters', () => {
    const messages = [{ role: 'user', content: 'What is @typescript/eslint?' }];

    const slug = generateSlug(messages);

    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('should limit to 5 words', () => {
    const messages = [
      { role: 'user', content: 'This is a very long question with many words' },
    ];

    const slug = generateSlug(messages);
    const words = slug.split('-');

    expect(words.length).toBeLessThanOrEqual(5);
  });

  it('should generate timestamp slug as fallback', () => {
    const slug = generateTimestampSlug();

    expect(slug).toMatch(/^session-\d{8}-\d{4}$/);
  });
});
