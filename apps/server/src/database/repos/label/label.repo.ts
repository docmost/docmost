import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { Label } from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

export const LabelType = {
  PAGE: 'page',
  SPACE: 'space',
} as const;

export type LabelType = (typeof LabelType)[keyof typeof LabelType];

@Injectable()
export class LabelRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async findById(
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<Label | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('labels')
      .selectAll()
      .where('id', '=', labelId)
      .executeTakeFirst();
  }

  async findByNameAndWorkspace(
    name: string,
    workspaceId: string,
    type: LabelType,
    trx?: KyselyTransaction,
  ): Promise<Label | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('labels')
      .selectAll()
      .where('name', '=', name.toLowerCase())
      .where('type', '=', type)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findOrCreate(
    name: string,
    workspaceId: string,
    type: LabelType,
    trx?: KyselyTransaction,
  ): Promise<Label> {
    const db = dbOrTx(this.db, trx);
    const normalizedName = name.trim().toLowerCase();

    const result = await db
      .insertInto('labels')
      .values({ name: normalizedName, type, workspaceId })
      .onConflict((oc) =>
        oc.columns(['name', 'type', 'workspaceId']).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    if (result) {
      return result;
    }

    return this.findByNameAndWorkspace(normalizedName, workspaceId, type, trx);
  }

  async findLabelsByPageId(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('labels')
      .innerJoin('pageLabels', 'pageLabels.labelId', 'labels.id')
      .select([
        'labels.id',
        'labels.name',
        'labels.type',
        'labels.createdAt',
        'labels.updatedAt',
        'labels.workspaceId',
      ])
      .where('pageLabels.pageId', '=', pageId)
      .where('labels.type', '=', LabelType.PAGE);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'labels.name', direction: 'asc', key: 'name' },
        { expression: 'labels.id', direction: 'asc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        name: cursor.name,
        id: cursor.id,
      }),
    });
  }

  async findLabels(
    workspaceId: string,
    type: LabelType,
    pagination: PaginationOptions,
  ) {
    let query = this.db
      .selectFrom('labels')
      .select(['id', 'name', 'type', 'createdAt', 'updatedAt', 'workspaceId'])
      .where('workspaceId', '=', workspaceId)
      .where('type', '=', type);

    if (pagination.query) {
      query = query.where(
        'name',
        'like',
        `%${pagination.query.toLowerCase()}%`,
      );
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'name', direction: 'asc' },
        { expression: 'id', direction: 'asc' },
      ],
      parseCursor: (cursor) => ({
        name: cursor.name,
        id: cursor.id,
      }),
    });
  }

  async addLabelToPage(
    pageId: string,
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('pageLabels')
      .values({ pageId, labelId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async removeLabelFromPage(
    pageId: string,
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageLabels')
      .where('pageId', '=', pageId)
      .where('labelId', '=', labelId)
      .execute();
  }

  async getPageLabelCount(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('pageLabels')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async getLabelPageCount(
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('pageLabels')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('labelId', '=', labelId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async deleteLabel(
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('labels')
      .where('id', '=', labelId)
      .execute();
  }

  async deleteOrphanedLabels(
    labelIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (labelIds.length === 0) return;
    const db = dbOrTx(this.db, trx);

    const labelsWithPages = await db
      .selectFrom('pageLabels')
      .select('labelId')
      .where('labelId', 'in', labelIds)
      .groupBy('labelId')
      .execute();

    const labelsStillInUse = new Set(labelsWithPages.map((r) => r.labelId));
    const orphanedIds = labelIds.filter((id) => !labelsStillInUse.has(id));

    if (orphanedIds.length > 0) {
      await db
        .deleteFrom('labels')
        .where('id', 'in', orphanedIds)
        .execute();
    }
  }

  async findPagesByLabelId(
    labelId: string,
    userId: string,
    opts?: { spaceId?: string },
  ) {
    let query = this.db
      .selectFrom('pages')
      .innerJoin('pageLabels', 'pageLabels.pageId', 'pages.id')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
        'pages.createdAt',
        'pages.updatedAt',
      ])
      .where('pageLabels.labelId', '=', labelId)
      .where('pages.deletedAt', 'is', null);

    if (opts?.spaceId) {
      query = query.where('pages.spaceId', '=', opts.spaceId);
    } else {
      query = query.where(
        'pages.spaceId',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(userId),
      );
    }

    return query.orderBy('pages.updatedAt', 'desc').execute();
  }

  async findLabelIdsByPageIds(
    pageIds: string[],
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const db = dbOrTx(this.db, trx);
    const results = await db
      .selectFrom('pageLabels')
      .select('labelId')
      .where('pageId', 'in', pageIds)
      .groupBy('labelId')
      .execute();

    return results.map((r) => r.labelId);
  }
}
