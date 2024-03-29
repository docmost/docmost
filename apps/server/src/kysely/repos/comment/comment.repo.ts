import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { executeTx } from '../../utils';
import {
  Comment,
  InsertableComment,
  UpdatableComment,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from 'src/helpers/pagination/pagination-options';

@Injectable()
export class CommentRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  // todo, add workspaceId
  async findById(commentId: string): Promise<Comment> {
    return await this.db
      .selectFrom('comments')
      .selectAll()
      .where('id', '=', commentId)
      .executeTakeFirst();
  }

  async findPageComments(pageId: string, paginationOptions: PaginationOptions) {
    return executeTx(this.db, async (trx) => {
      const comments = await trx
        .selectFrom('comments')
        .selectAll()
        .where('pageId', '=', pageId)
        .orderBy('createdAt', 'asc')
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let { count } = await trx
        .selectFrom('comments')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('pageId', '=', pageId)
        .executeTakeFirst();

      count = count as number;
      return { comments, count };
    });
  }

  async updateComment(
    updatableComment: UpdatableComment,
    commentId: string,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .updateTable('comments')
          .set(updatableComment)
          .where('id', '=', commentId)
          .execute();
      },
      trx,
    );
  }

  async insertComment(
    insertableComment: InsertableComment,
    trx?: KyselyTransaction,
  ): Promise<Comment> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('comments')
          .values(insertableComment)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.db.deleteFrom('comments').where('id', '=', commentId).execute();
  }
}
