import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { executeTx } from '@docmost/db/utils';
import { toVectorLiteral } from '../../../integrations/ai/embedding.util';

export interface EmbeddingChunkInput {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  modelName: string;
  modelDimensions: number;
  embedding: number[];
  chunkIndex: number;
  chunkStart: number;
  chunkLength: number;
}

export interface AnnSearchRow {
  pageId: string;
  chunkIndex: number;
  distance: number;
  title: string | null;
  slugId: string;
  spaceId: string;
  spaceSlug: string;
  chunkStart: number;
  chunkLength: number;
}

@Injectable()
export class EmbeddingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async deleteByPageIds(pageIds: string[]): Promise<void> {
    if (pageIds.length === 0) return;
    await this.db
      .deleteFrom('pageEmbeddings')
      .where('pageId', 'in', pageIds)
      .execute();
  }

  async deleteByWorkspace(workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('pageEmbeddings')
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  /** Replaces all stored chunks for a page in a single transaction. */
  async replacePageChunks(
    pageId: string,
    chunks: EmbeddingChunkInput[],
  ): Promise<void> {
    await executeTx(this.db, async (trx) => {
      await trx
        .deleteFrom('pageEmbeddings')
        .where('pageId', '=', pageId)
        .execute();

      if (chunks.length === 0) return;

      await trx
        .insertInto('pageEmbeddings')
        .values(
          chunks.map((c) => ({
            pageId: c.pageId,
            spaceId: c.spaceId,
            workspaceId: c.workspaceId,
            attachmentId: null,
            modelName: c.modelName,
            modelDimensions: c.modelDimensions,
            embedding: sql<number[]>`${toVectorLiteral(c.embedding)}::vector`,
            chunkIndex: c.chunkIndex,
            chunkStart: c.chunkStart,
            chunkLength: c.chunkLength,
          })),
        )
        .execute();
    });
  }

  async listWorkspacePageIds(workspaceId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('pages')
      .select('id')
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
    return rows.map((r) => r.id);
  }

  /**
   * Cosine-distance ANN search over the caller's accessible spaces.
   * Returns nearest chunks joined to page + space metadata.
   */
  async search(
    workspaceId: string,
    queryEmbedding: number[],
    opts: { spaceIds: string[]; limit: number },
  ): Promise<AnnSearchRow[]> {
    if (opts.spaceIds.length === 0) return [];
    const vec = sql`${toVectorLiteral(queryEmbedding)}::vector`;

    const rows = await this.db
      .selectFrom('pageEmbeddings as pe')
      .innerJoin('pages as p', 'p.id', 'pe.pageId')
      .innerJoin('spaces as s', 's.id', 'pe.spaceId')
      .where('pe.workspaceId', '=', workspaceId)
      .where('pe.spaceId', 'in', opts.spaceIds)
      .where('p.deletedAt', 'is', null)
      .select([
        'pe.pageId as pageId',
        'pe.chunkIndex as chunkIndex',
        'pe.chunkStart as chunkStart',
        'pe.chunkLength as chunkLength',
        'pe.spaceId as spaceId',
        'p.title as title',
        'p.slugId as slugId',
        's.slug as spaceSlug',
        sql<number>`pe.embedding <=> ${vec}`.as('distance'),
      ])
      .orderBy(sql`pe.embedding <=> ${vec}`)
      .limit(opts.limit)
      .execute();

    return rows as unknown as AnnSearchRow[];
  }
}
