import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { executeTx } from '../../utils';
import {
  InsertablePage,
  Page,
  UpdatablePage,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';

@Injectable()
export class PageOrderingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(pageId: string): Promise<Page> {
    return await this.db
      .selectFrom('pages')
      .selectAll()
      .where('id', '=', pageId)
      .executeTakeFirst();
  }

  async slug(slug: string): Promise<Page> {
    return await this.db
      .selectFrom('pages')
      .selectAll()
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .executeTakeFirst();
  }

  async updatePage(
    updatablePage: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .updateTable('pages')
          .set(updatablePage)
          .where('id', '=', pageId)
          .execute();
      },
      trx,
    );
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('pages')
          .values(insertablePage)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }
}
