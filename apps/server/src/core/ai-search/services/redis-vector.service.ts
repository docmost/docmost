import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  VectorSearchOptions,
  VectorSearchResult,
  VectorService,
} from './vector.service';
import {
  createClient,
  RedisClientType,
  SCHEMA_FIELD_TYPE,
  SCHEMA_VECTOR_FIELD_ALGORITHM,
} from 'redis';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

export interface IndexPageData {
  pageId: string;
  embedding: number[];
  metadata: {
    title?: string;
    workspaceId: string;
    spaceId?: string;
    [key: string]: any;
  };
}

export interface RedisVectorConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  indexName: string;
  vectorDimension: number;
}

@Injectable()
export class RedisVectorService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisVectorService.name);
  private readonly redis: RedisClientType;
  private readonly config: RedisVectorConfig;
  private isIndexCreated = false;

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly vectorService: VectorService,
  ) {
    //@ts-ignore
    this.config = {
      indexName: 'docmost_pages_index',
      vectorDimension: 1536, //AI_EMBEDDING_DIMENSIONS
    };

    this.redis = createClient({
      url: this.environmentService.getRedisUrl(),
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    this.initializeConnection();
  }

  async searchSimilar(
    queryEmbedding: number[],
    options: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    try {
      await this.ensureIndexExists();

      const { limit = 20, offset = 0, threshold = 0.7, filters } = options;

      // Build query following Redis specs
      let query = `*=>[KNN ${limit + offset} @embedding $vector AS score]`;
      
      // Apply filters if provided
      if (filters && Object.keys(filters).length > 0) {
        const filterClauses = Object.entries(filters).map(([key, value]) => {
          if (Array.isArray(value)) {
            return `@${key}:{${value.join('|')}}`;
          }
          return `@${key}:${value}`;
        });
        query = `(${filterClauses.join(' ')})=>[KNN ${limit + offset} @embedding $vector AS score]`;
      }

      // Execute search using proper node-redis syntax
      const searchOptions = {
        PARAMS: {
          vector: Buffer.from(new Float32Array(queryEmbedding).buffer),
        },
        SORTBY: {
          BY: '@score' as `@${string}`,
          DIRECTION: 'ASC' as 'ASC',
        },
        LIMIT: {
          from: offset,
          size: limit,
        },
        RETURN: ['page_id', 'workspace_id', 'space_id', 'title', 'score'],
        DIALECT: 2,
      };
      console.log(searchOptions);
      //is not assignable to parameter of type FtSearchOptions
      // Types of property SORTBY are incompatible.
      // Type { BY: string; DIRECTION: string; } is not assignable to type
      // RedisArgument | {   BY: `@${string}` | `$.${string}`;   DIRECTION?: 'DESC' | 'ASC'; }

      const searchResult = await this.redis.ft.search(
        this.config.indexName,
        query,
        searchOptions,
      );

      const results = this.parseSearchResults(searchResult, threshold);
      
      this.logger.debug(`Vector search found ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async indexPage(data: IndexPageData): Promise<void> {
    try {
      await this.ensureIndexExists();

      const key = this.vectorService.createVectorKey(
        data.pageId,
        data.metadata.workspaceId,
      );

      // Store vector and metadata using proper node-redis hash operations
      await this.redis.hSet(key, {
        page_id: data.pageId,
        workspace_id: data.metadata.workspaceId,
        space_id: data.metadata.spaceId || '',
        title: data.metadata.title || '',
        embedding: Buffer.from(new Float32Array(data.embedding).buffer),
        indexed_at: Date.now().toString(),
      });

      // Set TTL for the key
      await this.redis.expire(key, 86400 * 30); // 30 days TTL

      this.logger.debug(
        `Indexed page ${data.pageId} in workspace ${data.metadata.workspaceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to index page ${data.pageId}: ${error?.['message']}`,
        error,
      );
      throw error;
    }
  }

  async deletePage(pageId: string, workspaceId: string): Promise<void> {
    try {
      const key = this.vectorService.createVectorKey(pageId, workspaceId);

      await this.redis.del(key);

      this.logger.debug(`Deleted page ${pageId} from vector index`);
    } catch (error) {
      this.logger.error(
        `Failed to delete page ${pageId}: ${error?.['message']}`,
        error,
      );
      throw error;
    }
  }

  async batchIndexPages(
    pages: IndexPageData[],
  ): Promise<{ indexed: number; errors: string[] }> {
    const errors: string[] = [];
    let indexed = 0;

    try {
      await this.ensureIndexExists();

      // Process in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);

        // Use node-redis multi for batch operations
        const multi = this.redis.multi();

        for (const page of batch) {
          try {
            const key = this.vectorService.createVectorKey(
              page.pageId,
              page.metadata.workspaceId,
            );

            multi.hSet(key, {
              page_id: page.pageId,
              workspace_id: page.metadata.workspaceId,
              space_id: page.metadata.spaceId || '',
              title: page.metadata.title || '',
              embedding: Buffer.from(new Float32Array(page.embedding).buffer),
              indexed_at: Date.now().toString(),
            });

            multi.expire(key, 86400 * 30);
          } catch (error) {
            errors.push(`Page ${page.pageId}: ${error?.['message']}`);
          }
        }

        const results = await multi.exec();

        // Count successful operations
        const batchIndexed =
          //@ts-ignore
          results?.filter((result) => !result.error).length || 0;
        indexed += Math.floor(batchIndexed / 2); // Each page has 2 operations (hSet + expire)
      }

      this.logger.log(
        `Batch indexed ${indexed} pages with ${errors.length} errors`,
      );
      return { indexed, errors };
    } catch (error) {
      this.logger.error(`Batch indexing failed: ${error?.['message']}`, error);
      throw error;
    }
  }

  private async initializeConnection(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('create');
      await this.createIndex();
      this.isIndexCreated = true;
      this.logger.log('Redis vector database connected and index initialized');
    } catch (error) {
      this.logger.error(
        `Failed to initialize vector index: ${error?.['message']}`,
        error,
      );
      console.error(error);
    }
  }

  private async ensureIndexExists(): Promise<void> {
    console.log('creating index 1111');

    if (!this.isIndexCreated) {
      console.log('creating index');
      await this.createIndex();
      this.isIndexCreated = true;
    }
  }

  private async createIndex(): Promise<void> {
    try {
      // Check if index already exists using proper node-redis syntax
      await this.redis.ft.info(this.config.indexName);
      this.logger.debug(`Vector index ${this.config.indexName} already exists`);
      return;
    } catch (error) {
      // Index doesn't exist, create it
    }

    try {
      // Create index using proper node-redis schema definition
      await this.redis.ft.create(
        this.config.indexName,
        {
          page_id: {
            type: SCHEMA_FIELD_TYPE.TEXT,
            SORTABLE: true,
          },
          workspace_id: {
            type: SCHEMA_FIELD_TYPE.TEXT,
            SORTABLE: true,
          },
          space_id: {
            type: SCHEMA_FIELD_TYPE.TEXT,
          },
          title: {
            type: SCHEMA_FIELD_TYPE.TEXT,
          },
          embedding: {
            type: SCHEMA_FIELD_TYPE.VECTOR,
            ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW,
            TYPE: 'FLOAT32',
            DIM: this.config.vectorDimension,
            DISTANCE_METRIC: 'COSINE',
          },
          indexed_at: {
            type: SCHEMA_FIELD_TYPE.NUMERIC,
            SORTABLE: true,
          },
        },
        {
          ON: 'HASH',
          PREFIX: 'vector:',
        },
      );

      this.logger.log(`Created vector index ${this.config.indexName}`);
    } catch (error) {
      if (error?.['message']?.includes('Index already exists')) {
        this.logger.debug('Vector index already exists');
      } else {
        throw error;
      }
    }
  }

  private parseSearchResults(
    results: any,
    threshold: number,
  ): VectorSearchResult[] {
    if (!results?.documents || results.documents.length === 0) {
      return [];
    }

    const parsed: VectorSearchResult[] = [];

    for (const doc of results.documents) {
      const distance = parseFloat(doc.value?.distance || '1');
      const similarity = 1 - distance; // Convert distance to similarity

      if (similarity >= threshold) {
        parsed.push({
          pageId: doc.value?.page_id || doc.id.split(':')[1],
          score: similarity,
          metadata: {
            workspaceId: doc.value?.workspace_id,
            spaceId: doc.value?.space_id,
            title: doc.value?.title,
            distance,
          },
        });
      }
    }

    return parsed;
  }

  async getIndexStats(): Promise<{
    totalDocs: number;
    indexSize: string;
    vectorCount: number;
  }> {
    try {
      const info = await this.redis.ft.info(this.config.indexName);

      return {
        //@ts-ignore
        totalDocs: info.numDocs || 0,
        //@ts-ignore
        indexSize: info.indexSize || '0',
        //@ts-ignore
        vectorCount: info.numDocs || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get index stats: ${error?.['message']}`);
      return { totalDocs: 0, indexSize: '0', vectorCount: 0 };
    }
  }

  async deleteIndex(): Promise<void> {
    try {
      await this.redis.ft.dropIndex(this.config.indexName);
      this.isIndexCreated = false;
      this.logger.log(`Deleted vector index ${this.config.indexName}`);
    } catch (error) {
      this.logger.error(`Failed to delete index: ${error?.['message']}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis vector database disconnected');
    } catch (error) {
      this.logger.error(
        `Failed to disconnect from Redis: ${error?.['message']}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }
}
