import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertableTodo,
  Todo,
  UpdatableTodo,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class TodoRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    todoId: string,
    opts?: { includeCreator?: boolean },
  ): Promise<Todo> {
    return await this.db
      .selectFrom('todos')
      .selectAll('todos')
      .$if(opts?.includeCreator, (qb) => qb.select(this.withCreator))
      .where('id', '=', todoId)
      .executeTakeFirst();
  }

  async findPageTodos(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('todos')
      .selectAll('todos')
      .select((eb) => this.withCreator(eb))
      .where('pageId', '=', pageId);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'asc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async insertTodo(
    insertableTodo: InsertableTodo,
    trx?: KyselyTransaction,
  ): Promise<Todo> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('todos')
      .values(insertableTodo)
      .returningAll()
      .executeTakeFirst();
  }

  async updateTodo(
    updatableTodo: UpdatableTodo,
    todoId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('todos')
      .set(updatableTodo)
      .where('id', '=', todoId)
      .execute();
  }

  async deleteTodo(todoId: string): Promise<void> {
    await this.db.deleteFrom('todos').where('id', '=', todoId).execute();
  }

  withCreator(eb: ExpressionBuilder<DB, 'todos'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'todos.creatorId'),
    ).as('creator');
  }
}
