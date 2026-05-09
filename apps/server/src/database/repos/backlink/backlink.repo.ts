import {
  Backlink,
  InsertableBacklink,
  UpdatableBacklink,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  executeWithCursorPagination,
  emptyCursorPaginationResult,
} from '@docmost/db/pagination/cursor-pagination';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class BacklinkRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async findById(
    backlinkId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Backlink> {
    const db = dbOrTx(this.db, trx);

    return db
      .selectFrom('backlinks')
      .select([
        'id',
        'sourcePageId',
        'targetPageId',
        'workspaceId',
        'createdAt',
        'updatedAt',
      ])
      .where('id', '=', backlinkId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async insertBacklink(
    insertableBacklink: InsertableBacklink,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('backlinks')
      .values(insertableBacklink)
      .onConflict((oc) =>
        oc.columns(['sourcePageId', 'targetPageId']).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();
  }

  async updateBacklink(
    updatableBacklink: UpdatableBacklink,
    backlinkId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('userTokens')
      .set(updatableBacklink)
      .where('id', '=', backlinkId)
      .execute();
  }

  async deleteBacklink(
    backlinkId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db.deleteFrom('backlinks').where('id', '=', backlinkId).execute();
  }

  async findRelatedPageIds(
    pageId: string,
    direction: 'incoming' | 'outgoing',
    userId: string,
  ): Promise<string[]> {
    const userSpaceIds = this.spaceMemberRepo.getUserSpaceIdsQuery(userId);

    if (direction === 'incoming') {
      const rows = await this.db
        .selectFrom('backlinks')
        .innerJoin('pages', 'pages.id', 'backlinks.sourcePageId')
        .select('backlinks.sourcePageId as relatedId')
        .where('backlinks.targetPageId', '=', pageId)
        .where('pages.deletedAt', 'is', null)
        .where('pages.spaceId', 'in', userSpaceIds)
        .execute();
      return rows.map((r) => r.relatedId);
    }

    const rows = await this.db
      .selectFrom('backlinks')
      .innerJoin('pages', 'pages.id', 'backlinks.targetPageId')
      .select('backlinks.targetPageId as relatedId')
      .where('backlinks.sourcePageId', '=', pageId)
      .where('pages.deletedAt', 'is', null)
      .where('pages.spaceId', 'in', userSpaceIds)
      .execute();
    return rows.map((r) => r.relatedId);
  }

  async findPagesByIdsPaginated(
    pageIds: string[],
    pagination: PaginationOptions,
  ) {
    if (pageIds.length === 0) {
      return emptyCursorPaginationResult<{
        id: string;
        slugId: string;
        title: string | null;
        icon: string | null;
        spaceId: string;
        updatedAt: Date;
        space: { id: string; slug: string; name: string } | null;
      }>(pagination.limit);
    }

    const query = this.db
      .selectFrom('pages')
      .select((eb) => [
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
        'pages.updatedAt',
        jsonObjectFrom(
          eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.slug', 'spaces.name'])
            .whereRef('spaces.id', '=', 'pages.spaceId'),
        ).as('space'),
      ])
      .where('pages.deletedAt', 'is', null)
      .where('pages.id', 'in', pageIds);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'pages.updatedAt', direction: 'desc', key: 'updatedAt' },
        { expression: 'pages.id', direction: 'desc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
  }
}
