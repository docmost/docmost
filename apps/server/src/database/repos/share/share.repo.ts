import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertableShare,
  Share,
  UpdatableShare,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { validate as isValidUUID } from 'uuid';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export class ShareRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private spaceMemberRepo: SpaceMemberRepo,
  ) {}

  private baseFields: Array<keyof Share> = [
    'id',
    'key',
    'pageId',
    'includeSubPages',
    'creatorId',
    'spaceId',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(
    shareId: string,
    opts?: {
      includeCreator?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Share> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db.selectFrom('shares').select(this.baseFields);

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    if (isValidUUID(shareId)) {
      query = query.where('id', '=', shareId);
    } else {
      query = query.where('key', '=', shareId);
    }

    return query.executeTakeFirst();
  }

  async findByPageId(
    pageId: string,
    opts?: {
      includeCreator?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Share> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('shares')
      .select(this.baseFields)
      .where('pageId', '=', pageId);

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }
    return query.executeTakeFirst();
  }

  async updateShare(
    updatableShare: UpdatableShare,
    shareId: string,
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .updateTable('shares')
      .set({ ...updatableShare, updatedAt: new Date() })
      .where(!isValidUUID(shareId) ? 'key' : 'id', '=', shareId)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async insertShare(
    insertableShare: InsertableShare,
    trx?: KyselyTransaction,
  ): Promise<Share> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('shares')
      .values(insertableShare)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async deleteShare(shareId: string): Promise<void> {
    let query = this.db.deleteFrom('shares');

    if (isValidUUID(shareId)) {
      query = query.where('id', '=', shareId);
    } else {
      query = query.where('key', '=', shareId);
    }

    await query.execute();
  }

  async getShares(userId: string, pagination: PaginationOptions) {
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

    const query = this.db
      .selectFrom('shares')
      .select(this.baseFields)
      .select((eb) => this.withPage(eb))
      .select((eb) => this.withSpace(eb))
      .select((eb) => this.withCreator(eb))
      .where('spaceId', 'in', userSpaceIds)
      .orderBy('updatedAt', 'desc');

    const hasEmptyIds = userSpaceIds.length === 0;
    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
      hasEmptyIds,
    });

    return result;
  }

  withPage(eb: ExpressionBuilder<DB, 'shares'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('pages')
        .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.icon'])
        .whereRef('pages.id', '=', 'shares.pageId'),
    ).as('page');
  }

  withSpace(eb: ExpressionBuilder<DB, 'shares'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .whereRef('spaces.id', '=', 'shares.spaceId'),
    ).as('space');
  }

  withCreator(eb: ExpressionBuilder<DB, 'shares'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'shares.creatorId'),
    ).as('creator');
  }
}
