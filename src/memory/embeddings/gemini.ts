import type { EmbeddingProvider } from './base.js';
import { normalizeEmbedding } from './base.js';
import { logger } from '../../utils/logger.js';

export interface GeminiEmbeddingOptions {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSIONS = 768;

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'gemini' as const;
  readonly model: string;
  readonly maxInputTokens = 2048;

  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(options: GeminiEmbeddingOptions) {
    if (!options.apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.apiKey = options.apiKey;
    this.model = options.model || DEFAULT_MODEL;
  }

  async embedQuery(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/models/${this.model}:embedContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: text.slice(0, this.maxInputTokens * 4) }],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Gemini embedding failed');
      throw new Error(`Gemini embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding dimensions: ${embedding?.length}`);
    }

    return normalizeEmbedding(embedding);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          content: {
            parts: [{ text: text.slice(0, this.maxInputTokens * 4) }],
          },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Gemini batch embedding failed');
      throw new Error(`Gemini batch embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings.map((item: any) => normalizeEmbedding(item.values));
  }
}
