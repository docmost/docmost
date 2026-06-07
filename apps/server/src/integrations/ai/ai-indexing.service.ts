import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { embedMany } from 'ai';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  EmbeddingChunkInput,
  EmbeddingRepo,
} from '@docmost/db/repos/embedding/embedding.repo';
import { AiProviderService } from './ai-provider.service';
import { EnvironmentService } from '../environment/environment.service';
import { chunkText } from './embedding.util';

@Injectable()
export class AiIndexingService {
  private readonly logger = new Logger(AiIndexingService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly embeddingRepo: EmbeddingRepo,
    private readonly aiProviderService: AiProviderService,
    private readonly environmentService: EnvironmentService,
  ) {}

  /** Embeddings run only when configured AND the workspace has AI Search on. */
  async isEnabled(workspaceId: string): Promise<boolean> {
    if (!this.aiProviderService.isEmbeddingConfigured()) return false;
    const ws = await this.db
      .selectFrom('workspaces')
      .select('settings')
      .where('id', '=', workspaceId)
      .executeTakeFirst();
    const settings = (ws?.settings ?? {}) as { ai?: { search?: boolean } };
    return settings.ai?.search === true;
  }

  async embedPages(pageIds: string[], workspaceId: string): Promise<void> {
    if (pageIds.length === 0) return;
    if (!(await this.isEnabled(workspaceId))) return;

    const model = this.aiProviderService.embeddingModel();
    const modelName = this.environmentService.getAiEmbeddingModel();
    const modelDimensions = this.aiProviderService.embeddingDimension();

    for (const pageId of pageIds) {
      const page = await this.db
        .selectFrom('pages')
        .select(['id', 'textContent', 'spaceId', 'workspaceId', 'deletedAt'])
        .where('id', '=', pageId)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      if (!page || page.deletedAt) {
        await this.embeddingRepo.deleteByPageIds([pageId]);
        continue;
      }

      const chunks = await chunkText(page.textContent ?? '');
      if (chunks.length === 0) {
        await this.embeddingRepo.deleteByPageIds([pageId]);
        continue;
      }

      const { embeddings } = await embedMany({
        model,
        values: chunks.map((c) => c.text),
      });

      const rows: EmbeddingChunkInput[] = chunks.map((c, i) => ({
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
        modelName,
        modelDimensions,
        embedding: embeddings[i],
        chunkIndex: c.index,
        chunkStart: c.start,
        chunkLength: c.length,
      }));

      await this.embeddingRepo.replacePageChunks(page.id, rows);
    }
  }

  async deletePages(pageIds: string[]): Promise<void> {
    await this.embeddingRepo.deleteByPageIds(pageIds);
  }

  async backfillWorkspace(workspaceId: string): Promise<void> {
    if (!(await this.isEnabled(workspaceId))) return;
    const pageIds = await this.embeddingRepo.listWorkspacePageIds(workspaceId);
    const batchSize = 20;
    for (let i = 0; i < pageIds.length; i += batchSize) {
      await this.embedPages(pageIds.slice(i, i + batchSize), workspaceId);
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.embeddingRepo.deleteByWorkspace(workspaceId);
  }
}
