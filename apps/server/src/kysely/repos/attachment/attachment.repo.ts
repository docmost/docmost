import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  Attachment,
  InsertableAttachment,
  UpdatableAttachment,
} from '@docmost/db/types/entity.types';

@Injectable()
export class AttachmentRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    attachmentId: string,
    workspaceId: string,
  ): Promise<Attachment> {
    return this.db
      .selectFrom('attachments')
      .selectAll()
      .where('id', '=', attachmentId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async insertAttachment(
    insertableAttachment: InsertableAttachment,
    trx?: KyselyTransaction,
  ): Promise<Attachment> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('attachments')
          .values(insertableAttachment)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async updateAttachment(
    updatableAttachment: UpdatableAttachment,
    attachmentId: string,
  ): Promise<void> {
    await this.db
      .updateTable('attachments')
      .set(updatableAttachment)
      .where('id', '=', attachmentId)
      .returningAll()
      .executeTakeFirst();
  }
}
