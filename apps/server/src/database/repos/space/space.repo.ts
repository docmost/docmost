import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableSpace,
  Space,
  UpdatableSpace,
} from '@docmost/db/types/entity.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { DB } from '@docmost/db/types/db';
import { validate as isValidUUID } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';

@Injectable()
export class SpaceRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private eventEmitter: EventEmitter2,
  ) {}

  async findById(
    spaceId: string,
    workspaceId: string,
    opts?: { includeMemberCount?: boolean; trx?: KyselyTransaction },
  ): Promise<Space> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('spaces')
      .selectAll('spaces')
      .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
      .where('workspaceId', '=', workspaceId);

    if (isValidUUID(spaceId)) {
      query = query.where('id', '=', spaceId);
    } else {
      query = query.where(sql`LOWER(slug)`, '=', sql`LOWER(${spaceId})`);
    }
    return query.executeTakeFirst();
  }

  async findBySlug(
    slug: string,
    workspaceId: string,
    opts?: { includeMemberCount: boolean },
  ): Promise<Space> {
    return await this.db
      .selectFrom('spaces')
      .selectAll('spaces')
      .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async slugExists(
    slug: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<boolean> {
    const db = dbOrTx(this.db, trx);
    let { count } = await db
      .selectFrom('spaces')
      .select((eb) => eb.fn.count('id').as('count'))
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    count = count as number;
    return count != 0;
  }

  async updateSpace(
    updatableSpace: UpdatableSpace,
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({ ...updatableSpace, updatedAt: new Date() })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  async insertSpace(
    insertableSpace: InsertableSpace,
    trx?: KyselyTransaction,
  ): Promise<Space> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('spaces')
      .values(insertableSpace)
      .returningAll()
      .executeTakeFirst();
  }

  async getSpacesInWorkspace(
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    // todo: show spaces user have access based on visibility and memberships
    let query = this.db
      .selectFrom('spaces')
      .selectAll('spaces')
      .select((eb) => [this.withMemberCount(eb)])
      .where('workspaceId', '=', workspaceId)
      .orderBy('createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb(
          sql`f_unaccent(name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ).or(
          sql`f_unaccent(description)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ),
      );
    }

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  withMemberCount(eb: ExpressionBuilder<DB, 'spaces'>) {
    const subquery = eb
      .selectFrom('spaceMembers')
      .select('spaceMembers.userId')
      .where('spaceMembers.userId', 'is not', null)
      .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
      .union(
        eb
          .selectFrom('spaceMembers')
          .where('spaceMembers.groupId', 'is not', null)
          .leftJoin('groups', 'groups.id', 'spaceMembers.groupId')
          .leftJoin('groupUsers', 'groupUsers.groupId', 'groups.id')
          .select('groupUsers.userId')
          .whereRef('spaceMembers.spaceId', '=', 'spaces.id'),
      )
      .as('userId');

    return eb
      .selectFrom(subquery)
      .select((eb) => eb.fn.count('userId').as('count'))
      .as('memberCount');
  }

  async deleteSpace(spaceId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('spaces')
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .execute();

    this.eventEmitter.emit(EventName.SPACE_DELETED, {
      spaceId,
    });
  }
}
