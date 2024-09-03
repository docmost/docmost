import {
  InsertableTemporaryCode,
  TemporaryCode,
  UpdatableTemporaryCode,
} from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { hashPassword } from 'src/common/helpers';

@Injectable()
export class TemporaryCodeRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertTemporaryCode(
    insertableTemporaryCode: InsertableTemporaryCode,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('temporaryCodes')
      .values(insertableTemporaryCode)
      .returningAll()
      .executeTakeFirst();
  }

  async findByUserId(
    userId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('temporaryCodes')
      .select([
        'id',
        'code',
        'user_id',
        'workspace_id',
        'expires_at',
        'used_at',
        'created_at',
      ])
      .where('user_id', '=', userId)
      .where('workspace_id', '=', workspaceId)
      .orderBy('expires_at desc')
      .execute();
  }

  async updateTemporaryCode(
    updatableTemporaryCode: UpdatableTemporaryCode,
    temporaryCodeId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('temporaryCodes')
      .set({ ...updatableTemporaryCode })
      .where('id', '=', temporaryCodeId)
      .execute();
  }
}
