import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface EmbeddingConfig {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly config: EmbeddingConfig;
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      model: this.configService.get<string>(
        'AI_EMBEDDING_MODEL',
        'text-embedding-3-small',
      ),
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      baseUrl: 'https://api.openai.com/v1/',
      dimensions: Number(
        this.configService.get<string>('AI_EMBEDDING_DIMENSIONS', '1536'),
      ),
    };

    if (!this.config.apiKey) {
      this.logger.warn(
        'OpenAI API key not configured. AI search will not work.',
      );
    }

    // Initialize OpenAI client with optional custom base URL
    this.openai = new OpenAI({
      apiKey: this.config.apiKey || 'dummy-key',
      baseURL: this.config.baseUrl,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const cleanText = this.preprocessText(text);
    console.log('generate clean text', cleanText);

    try {
      const result = await this.generateEmbeddingWithOpenAI(cleanText);
      console.log('embedding results', result);
      return result.embedding;
    } catch (error) {
      this.logger.error(`Embedding generation failed:`, error);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const cleanTexts = texts.map((text) => this.preprocessText(text));
    const batchSize = this.getBatchSize();
    const results: number[][] = [];

    for (let i = 0; i < cleanTexts.length; i += batchSize) {
      const batch = cleanTexts.slice(i, i + batchSize);

      try {
        const batchResults = await this.generateBatchEmbeddings(batch);
        results.push(...batchResults);
      } catch (error) {
        this.logger.error(
          `Batch embedding generation failed for batch ${i}:`,
          error,
        );
        throw error;
      }
    }

    return results;
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateEmbeddingWithOpenAI(
    text: string,
  ): Promise<EmbeddingResult> {
    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: text,
      dimensions: this.config.dimensions,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('Invalid response from OpenAI API');
    }

    return {
      embedding: response.data[0].embedding,
      tokens: response.usage?.total_tokens || 0,
      model: this.config.model,
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  private async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: texts,
      dimensions: this.config.dimensions,
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from OpenAI API');
    }

    return response.data.map((item) => item.embedding);
  }

  /**
   * Preprocess text before embedding generation
   */
  private preprocessText(text: string): string {
    if (!text) return '';

    // Remove excessive whitespace
    let processed = text.replace(/\s+/g, ' ').trim();

    // Truncate if too long (most models have token limits)
    const maxLength = 8000; // Conservative limit
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength);
    }

    return processed;
  }

  /**
   * Get batch size for OpenAI API
   */
  private getBatchSize(): number {
    return 100; // OpenAI supports up to 2048 inputs
  }

  /**
   * Sleep utility for retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if embedding service is configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Get embedding configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }
}
