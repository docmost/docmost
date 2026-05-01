import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  Group,
  InsertableGroup,
  UpdatableGroup,
} from '@docmost/db/types/entity.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { DB, Groups } from '@docmost/db/types/db';
import { DefaultGroup } from '../../../core/group/dto/create-group.dto';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class GroupRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Groups> = [
    'id',
    'name',
    'description',
    'isDefault',
    'isExternal',
    'creatorId',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(
    groupId: string,
    workspaceId: string,
    opts?: {
      includeMemberCount?: boolean;
      includeScimExternalId?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Group> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('groups')
      .select(this.baseFields)
      .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
      .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByName(
    groupName: string,
    workspaceId: string,
    opts?: {
      includeMemberCount?: boolean;
      includeScimExternalId?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Group> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('groups')
      .select(this.baseFields)
      .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
      .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
      .where(sql`LOWER(name)`, '=', sql`LOWER(${groupName})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async update(
    updatableGroup: UpdatableGroup,
    groupId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);

    await db
      .updateTable('groups')
      .set({ ...updatableGroup, updatedAt: new Date() })
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async insertGroup(
    insertableGroup: InsertableGroup,
    trx?: KyselyTransaction,
  ): Promise<Group> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('groups')
      .values(insertableGroup)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async getDefaultGroup(
    workspaceId: string,
    trx: KyselyTransaction,
  ): Promise<Group> {
    const db = dbOrTx(this.db, trx);
    return (
      db
        .selectFrom('groups')
        .select(this.baseFields)
        // .select((eb) => this.withMemberCount(eb))
        .where('isDefault', '=', true)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst()
    );
  }

  async createDefaultGroup(
    workspaceId: string,
    opts?: { userId?: string; trx?: KyselyTransaction },
  ): Promise<Group> {
    const { userId, trx } = opts;
    const insertableGroup: InsertableGroup = {
      name: DefaultGroup.EVERYONE,
      isDefault: true,
      creatorId: userId,
      workspaceId: workspaceId,
    };

    return this.insertGroup(insertableGroup, trx);
  }

  async getGroupsPaginated(workspaceId: string, pagination: PaginationOptions) {
    let baseQuery = this.db
      .selectFrom('groups')
      .select(this.baseFields)
      .select((eb) => this.withMemberCount(eb))
      .where('workspaceId', '=', workspaceId);

    if (pagination.query) {
      baseQuery = baseQuery.where((eb) =>
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

    const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');
    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        {
          expression: 'sub.memberCount',
          direction: 'desc',
          key: 'memberCount',
        },
        { expression: 'sub.name', direction: 'asc', key: 'name' },
        { expression: 'sub.id', direction: 'asc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        memberCount: parseInt(cursor.memberCount, 10),
        name: cursor.name,
        id: cursor.id,
      }),
    });
  }

  withMemberCount(eb: ExpressionBuilder<DB, 'groups'>) {
    return eb
      .selectFrom('groupUsers')
      .select((eb) => eb.fn.countAll().as('count'))
      .whereRef('groupUsers.groupId', '=', 'groups.id')
      .as('memberCount');
  }

  async delete(
    groupId: string,
    workspaceId: string,
    opts?: { trx?: KyselyTransaction },
  ): Promise<void> {
    const { trx } = opts;
    const db = dbOrTx(this.db, trx);

    await db
      .deleteFrom('groups')
      .where('id', '=', groupId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
