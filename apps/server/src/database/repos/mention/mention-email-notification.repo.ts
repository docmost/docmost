import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import type { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import type {
  InsertableMentionEmailNotification,
  MentionEmailNotification,
} from '../../types/entity.types';

@Injectable()
export class MentionEmailNotificationRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findSentMentionIds(
    workspaceId: string,
    mentionIds: string[],
    trx?: KyselyTransaction,
  ): Promise<Set<string>> {
    if (!mentionIds?.length) return new Set();
    const db = dbOrTx(this.db, trx);
    const rows = await db
      .selectFrom('mentionEmailNotifications')
      .select(['mentionId'])
      .where('workspaceId', '=', workspaceId)
      .where('mentionId', 'in', mentionIds)
      .where('sentAt', 'is not', null)
      .execute();
    return new Set(rows.map((r) => r.mentionId));
  }

  async insertSent(
    notification: Omit<
      InsertableMentionEmailNotification,
      'id' | 'createdAt' | 'sentAt'
    >,
    trx?: KyselyTransaction,
  ): Promise<MentionEmailNotification | undefined> {
    const db = dbOrTx(this.db, trx);

    // Idempotent insert: if we already recorded this mention, do nothing.
    const inserted = await db
      .insertInto('mentionEmailNotifications')
      .values({
        ...notification,
        createdAt: new Date(),
        sentAt: new Date(),
      })
      .onConflict((oc) =>
        oc.columns(['workspaceId', 'mentionId']).doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    return inserted;
  }
}


