/**
 * Base interface for embedding providers.
 */
export interface EmbeddingProvider {
  readonly id: 'openrouter' | 'gemini' | 'local';
  readonly model: string;
  readonly maxInputTokens: number;

  /**
   * Generate embedding for a single text query.
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in batch.
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Normalize embedding vector to unit length (L2 normalization).
 * Required for cosine similarity search.
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
}

/**
 * Provider configuration options.
 */
export interface EmbeddingProviderOptions {
  provider: 'openrouter' | 'gemini' | 'local' | 'auto';
  fallback?: 'openrouter' | 'gemini' | 'local' | 'none';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  local?: {
    modelPath?: string;
    modelCacheDir?: string;
  };
}

/**
 * Result of provider creation with fallback info.
 */
export interface EmbeddingProviderResult {
  provider: EmbeddingProvider;
  requestedProvider: string;
  fallbackFrom?: string;
  fallbackReason?: string;
}
