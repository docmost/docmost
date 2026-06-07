import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableOrganizeEvent,
  InsertableOrganizeTask,
  OrganizeEvent,
  OrganizeTask,
  UpdatableOrganizeTask,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class OrganizeRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<OrganizeTask | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('organizeTasks')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByShareToken(
    shareToken: string,
    workspaceId: string,
  ): Promise<OrganizeTask | undefined> {
    return this.db
      .selectFrom('organizeTasks')
      .selectAll()
      .where('shareToken', '=', shareToken)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async insert(
    insertable: InsertableOrganizeTask,
    trx?: KyselyTransaction,
  ): Promise<OrganizeTask> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('organizeTasks')
      .values(insertable)
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    updatable: UpdatableOrganizeTask,
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<OrganizeTask> {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('organizeTasks')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  async insertEvent(
    insertable: InsertableOrganizeEvent,
    trx?: KyselyTransaction,
  ): Promise<OrganizeEvent> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('organizeEvents')
      .values(insertable)
      .returningAll()
      .executeTakeFirst();
  }

  async findEvents(
    organizeTaskId: string,
    limit = 200,
  ): Promise<OrganizeEvent[]> {
    return this.db
      .selectFrom('organizeEvents')
      .selectAll()
      .where('organizeTaskId', '=', organizeTaskId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .execute();
  }

  async getTasksPaginated(workspaceId: string, pagination: PaginationOptions) {
    const baseQuery = this.db
      .selectFrom('organizeTasks')
      .selectAll()
      .where('workspaceId', '=', workspaceId);

    const query = this.db.selectFrom(baseQuery.as('sub')).selectAll('sub');

    // ids are time-ordered uuid v7, so a single id cursor yields newest-first order
    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'sub.id', direction: 'desc', key: 'id' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }
}
