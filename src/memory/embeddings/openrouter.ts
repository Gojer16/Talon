import type { EmbeddingProvider } from './base.js';
import { normalizeEmbedding } from './base.js';
import { logger } from '../../utils/logger.js';

export interface OpenRouterEmbeddingOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'openai/text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openrouter' as const;
  readonly model: string;
  readonly maxInputTokens = 8191;

  private apiKey: string;
  private baseUrl: string;

  constructor(options: OpenRouterEmbeddingOptions) {
    if (!options.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
    this.apiKey = options.apiKey;
    this.model = options.model || DEFAULT_MODEL;
    this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1';
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://talon.ai',
        'X-Title': 'Talon Memory System',
      },
      body: JSON.stringify({
        model: this.model,
        input: text.slice(0, this.maxInputTokens * 4),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'OpenRouter embedding failed');
      throw new Error(`OpenRouter embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding dimensions: ${embedding?.length}`);
    }

    return normalizeEmbedding(embedding);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://talon.ai',
        'X-Title': 'Talon Memory System',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((t) => t.slice(0, this.maxInputTokens * 4)),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'OpenRouter batch embedding failed');
      throw new Error(`OpenRouter batch embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => normalizeEmbedding(item.embedding));
  }
}
