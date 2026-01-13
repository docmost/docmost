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
import { ExpressionBuilder, sql } from 'kysely';
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
    'searchIndexing',
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
      includeSharedPage?: boolean;
      includeCreator?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Share> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db.selectFrom('shares').select(this.baseFields);

    if (opts?.includeSharedPage) {
      query = query.select((eb) => this.withSharedPage(eb));
    }

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    if (isValidUUID(shareId)) {
      query = query.where('id', '=', shareId);
    } else {
      query = query.where(sql`LOWER(key)`, '=', shareId.toLowerCase());
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
      .where(
        isValidUUID(shareId) ? 'id' : sql`LOWER(key)`,
        '=',
        shareId.toLowerCase(),
      )
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
      query = query.where(sql`LOWER(key)`, '=', shareId.toLowerCase());
    }

    await query.execute();
  }

  async getShares(userId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('shares')
      .select(this.baseFields)
      .select((eb) => this.withPage(eb))
      .select((eb) => this.withSpace(eb, userId))
      .select((eb) => this.withCreator(eb))
      .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId))
      .orderBy('updatedAt', 'desc');

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });
  }

  withPage(eb: ExpressionBuilder<DB, 'shares'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('pages')
        .select(['pages.id', 'pages.title', 'pages.slugId', 'pages.icon'])
        .whereRef('pages.id', '=', 'shares.pageId'),
    ).as('page');
  }

  withSpace(eb: ExpressionBuilder<DB, 'shares'>, userId?: string) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .$if(Boolean(userId), (qb) =>
          qb.select((eb) => this.withUserSpaceRole(eb, userId)),
        )
        .whereRef('spaces.id', '=', 'shares.spaceId'),
    ).as('space');
  }

  withUserSpaceRole(eb: ExpressionBuilder<DB, 'spaces'>, userId: string) {
    return eb
      .selectFrom(
        eb
          .selectFrom('spaceMembers')
          .select(['spaceMembers.role'])
          .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
          .where('spaceMembers.userId', '=', userId)
          .unionAll(
            eb
              .selectFrom('spaceMembers')
              .innerJoin(
                'groupUsers',
                'groupUsers.groupId',
                'spaceMembers.groupId',
              )
              .select(['spaceMembers.role'])
              .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
              .where('groupUsers.userId', '=', userId),
          )
          .as('roles_union'),
      )
      .select('roles_union.role')
      .orderBy(
        sql`CASE roles_union.role
            WHEN 'admin' THEN 3
            WHEN 'writer' THEN 2
            WHEN 'reader' THEN 1
            ELSE 0
           END`,

        'desc',
      )
      .limit(1)
      .as('userRole');
  }

  withCreator(eb: ExpressionBuilder<DB, 'shares'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'shares.creatorId'),
    ).as('creator');
  }

  withSharedPage(eb: ExpressionBuilder<DB, 'shares'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('pages')
        .select([
          'pages.id',
          'pages.slugId',
          'pages.title',
          'pages.icon',
          'pages.parentPageId',
        ])
        .whereRef('pages.id', '=', 'shares.pageId'),
    ).as('sharedPage');
  }
}
