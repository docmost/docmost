import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AiSearchService } from '../services/ai-search.service';
import { EmbeddingService } from '../services/embedding.service';
import { RedisVectorService } from '../services/redis-vector.service';
import { Page } from '@docmost/db/types/entity.types';
import { UpdatedPageEvent } from '../../../collaboration/listeners/history.listener';

export interface PageUpdateEvent {
  pageId: string;
  workspaceId: string;
  spaceId: string;
  title?: string;
  textContent?: string;
  operation: 'create' | 'update' | 'delete';
}

@Injectable()
export class PageUpdateListener {
  private readonly logger = new Logger(PageUpdateListener.name);

  constructor(
    private readonly aiSearchService: AiSearchService,
    private readonly embeddingService: EmbeddingService,
    private readonly redisVectorService: RedisVectorService,
  ) {}

  @OnEvent('page.created')
  async handlePageCreated(event: Page) {
    await this.indexPage(event);
  }

  @OnEvent('collab.page.updated')
  async handlePageUpdated(event: UpdatedPageEvent) {
    await this.indexPage(event.page);
  }

  @OnEvent('page.deleted')
  async handlePageDeleted(event: Page) {
    try {
      await this.redisVectorService.deletePage(event.id, event.workspaceId);
      this.logger.debug(`Removed page ${event.id} from vector index`);
    } catch (error) {
      this.logger.error(
        `Failed to remove page ${event.id} from vector index:`,
        error,
      );
    }
  }

  private async indexPage(event: Page) {
    try {
      const content = `${event.title || ''} ${event.textContent || ''}`.trim();

      if (!content) {
        this.logger.debug(
          `Skipping indexing for page ${event.id} - no content`,
        );
        return;
      }

      if (!this.embeddingService.isConfigured()) {
        this.logger.debug(
          'Embedding service not configured, skipping indexing',
        );
        return;
      }

      const embedding = await this.embeddingService.generateEmbedding(content);

      console.log('embedding', embedding);

      await this.redisVectorService.indexPage({
        pageId: event.id,
        embedding,
        metadata: {
          title: event.title,
          workspaceId: event.workspaceId,
          spaceId: event.spaceId,
        },
      });

      this.logger.debug(`Indexed page ${event.id} for AI search`);
    } catch (error) {
      this.logger.error(`Failed to index page ${event.id}:`, error);
    }
  }
}
