import type { EmbeddingProvider } from './base.js';
import { normalizeEmbedding } from './base.js';
import { logger } from '../../utils/logger.js';

export interface LocalEmbeddingOptions {
  modelPath?: string;
  modelCacheDir?: string;
}

const DEFAULT_MODEL = 'embeddinggemma-300m-qat-Q8_0.gguf';
const EMBEDDING_DIMENSIONS = 256;

/**
 * Local embedding provider using llama.cpp.
 * Note: This is a placeholder implementation.
 * Full implementation requires node-llama-cpp package.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local' as const;
  readonly model: string;
  readonly maxInputTokens = 512;

  private modelPath?: string;

  private constructor(options: LocalEmbeddingOptions) {
    this.modelPath = options.modelPath;
    this.model = DEFAULT_MODEL;
  }

  static async create(options: LocalEmbeddingOptions): Promise<LocalEmbeddingProvider> {
    // Check if node-llama-cpp is available
    try {
      // Try to import node-llama-cpp
      await import('node-llama-cpp');
      logger.info('Local embeddings available via node-llama-cpp');
    } catch (error) {
      throw new Error(
        'Local embeddings require node-llama-cpp package. Install with: npm install --save-optional node-llama-cpp',
      );
    }

    return new LocalEmbeddingProvider(options);
  }

  async embedQuery(text: string): Promise<number[]> {
    // Placeholder: In real implementation, this would use node-llama-cpp
    throw new Error('Local embeddings not yet implemented. Use OpenRouter or Gemini instead.');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Placeholder: In real implementation, this would use node-llama-cpp
    throw new Error('Local embeddings not yet implemented. Use OpenRouter or Gemini instead.');
  }
}
