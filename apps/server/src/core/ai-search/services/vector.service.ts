import { Injectable, Logger } from '@nestjs/common';

export interface VectorSearchResult {
  pageId: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorSearchOptions {
  limit?: number;
  offset?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  euclideanDistance(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let sum = 0;
    for (let i = 0; i < vectorA.length; i++) {
      const diff = vectorA[i] - vectorB[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Calculate dot product similarity
   */
  dotProductSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
    }

    return dotProduct;
  }

  /**
   * Normalize a vector to unit length
   */
  normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0),
    );
    if (magnitude === 0) {
      return vector;
    }
    return vector.map((val) => val / magnitude);
  }

  /**
   * Convert vector to string format for Redis storage
   */
  vectorToString(vector: number[]): string {
    return vector.join(',');
  }

  /**
   * Parse vector from string format
   */
  stringToVector(vectorString: string): number[] {
    return vectorString.split(',').map((val) => parseFloat(val));
  }

  /**
   * Validate vector format and dimensions
   */
  validateVector(vector: number[], expectedDimensions?: number): boolean {
    if (!Array.isArray(vector)) {
      return false;
    }

    if (vector.length === 0) {
      return false;
    }

    if (expectedDimensions && vector.length !== expectedDimensions) {
      return false;
    }

    return vector.every((val) => typeof val === 'number' && !isNaN(val));
  }

  /**
   * Calculate similarity score with configurable method
   */
  calculateSimilarity(
    vectorA: number[],
    vectorB: number[],
    method: 'cosine' | 'euclidean' | 'dot' = 'cosine',
  ): number {
    switch (method) {
      case 'cosine':
        return this.cosineSimilarity(vectorA, vectorB);
      case 'euclidean': // Convert distance to similarity (0-1 scale)
      {
        const distance = this.euclideanDistance(vectorA, vectorB);
        return 1 / (1 + distance);
      }
      case 'dot':
        return this.dotProductSimilarity(vectorA, vectorB);
      default:
        throw new Error(`Unsupported similarity method: ${method}`);
    }
  }

  /**
   * Filter results by similarity threshold
   */
  filterByThreshold(
    results: VectorSearchResult[],
    threshold: number,
  ): VectorSearchResult[] {
    return results.filter((result) => result.score >= threshold);
  }

  /**
   * Sort results by similarity score (descending)
   */
  sortByScore(results: VectorSearchResult[]): VectorSearchResult[] {
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Apply pagination to results
   */
  paginateResults(
    results: VectorSearchResult[],
    offset: number = 0,
    limit: number = 20,
  ): VectorSearchResult[] {
    return results.slice(offset, offset + limit);
  }

  /**
   * Create vector index key for Redis
   */
  createVectorKey(pageId: string, workspaceId: string): string {
    return `vector:${workspaceId}:${pageId}`;
  }

  /**
   * Create metadata key for Redis
   */
  createMetadataKey(pageId: string, workspaceId: string): string {
    return `metadata:${workspaceId}:${pageId}`;
  }

  /**
   * Batch process vectors with chunking
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 100,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
      } catch (error) {
        this.logger.error(
          `Batch processing failed for items ${i}-${i + batch.length}:`,
          error,
        );
        throw error;
      }
    }

    return results;
  }
}
