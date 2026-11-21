import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { HtmlBlock, InsertableHtmlBlock } from '@docmost/db/types/entity.types';

@Injectable()
export class HtmlBlockRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(
    data: InsertableHtmlBlock,
    trx?: KyselyTransaction,
  ): Promise<HtmlBlock> {
    return dbOrTx(this.db, trx)
      .insertInto('htmlBlocks')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async insertMany(
    rows: InsertableHtmlBlock[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (rows.length === 0) return;
    await dbOrTx(this.db, trx).insertInto('htmlBlocks').values(rows).execute();
  }

  async findById(
    id: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<HtmlBlock | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('htmlBlocks')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByIds(
    ids: string[],
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<HtmlBlock[]> {
    if (ids.length === 0) return [];
    return dbOrTx(this.db, trx)
      .selectFrom('htmlBlocks')
      .selectAll()
      .where('id', 'in', ids)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
