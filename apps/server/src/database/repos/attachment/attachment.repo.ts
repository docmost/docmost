import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { ExpressionBuilder, sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { DB } from '@docmost/db/types/db';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  Attachment,
  InsertableAttachment,
  UpdatableAttachment,
} from '@docmost/db/types/entity.types';
import { AttachmentType } from '../../../core/attachment/attachment.constants';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class AttachmentRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Attachment> = [
    'id',
    'fileName',
    'filePath',
    'fileSize',
    'fileExt',
    'mimeType',
    'type',
    'diagramType',
    'diagramId',
    'creatorId',
    'pageId',
    'spaceId',
    'aiChatId',
    'templateId',
    'workspaceId',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(
    attachmentId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('id', '=', attachmentId)
      .executeTakeFirst();
  }

  async findDiagramHistory(attachment: Attachment, before?: string) {
    const root = attachment.diagramId ?? attachment.id;
    let query = this.db
      .selectFrom('attachments')
      .select(['id', 'fileName', 'createdAt'])
      .select(sql<number>`(row_number() over (order by attachments.created_at, attachments.id))::integer`.as('version'))
      .select((eb) => this.withCreator(eb))
      .where((eb) => eb.or([eb('id', '=', root), eb('diagramId', '=', root)]))
      .where('workspaceId', '=', attachment.workspaceId)
      .where('diagramType', '=', attachment.diagramType)
      .where('deletedAt', 'is', null);
    query = attachment.templateId
      ? query.where('templateId', '=', attachment.templateId)
      : query.where('pageId', '=', attachment.pageId);
    if (before) {
      const cursor = query
        .clearSelect()
        .select(['createdAt', 'id'])
        .where('id', '=', before);
      query = query.where((eb) =>
        eb(
          eb.refTuple('createdAt', 'id'),
          '<',
          cursor.$asTuple('createdAt', 'id'),
        ),
      );
    }
    return query
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(25)
      .execute();
  }

  async findByIdWithContent(
    attachmentId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select([...this.baseFields, 'textContent'])
      .where('id', '=', attachmentId)
      .executeTakeFirst();
  }

  async insertAttachment(
    insertableAttachment: InsertableAttachment,
    trx?: KyselyTransaction,
  ): Promise<Attachment> {
    const db = dbOrTx(this.db, trx);

    return db
      .insertInto('attachments')
      .values(insertableAttachment)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async findBySpaceId(
    spaceId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment[]> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('spaceId', '=', spaceId)
      .execute();
  }

  async findPageAttachments(pageId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('attachments')
      .select(this.baseFields)
      .select((eb) => this.withCreator(eb))
      .where('pageId', '=', pageId)
      .where('type', '=', AttachmentType.File)
      .where('deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('diagramType', 'is', null),
          eb.not(
            eb.exists(
              eb
                .selectFrom('attachments as newer')
                .select('newer.id')
                .whereRef('newer.pageId', '=', 'attachments.pageId')
                .where(
                  'newer.diagramId',
                  '=',
                  eb.fn.coalesce('attachments.diagramId', 'attachments.id'),
                )
                .where('newer.deletedAt', 'is', null)
                .where((ref) =>
                  ref(
                    ref.refTuple('newer.createdAt', 'newer.id'),
                    '>',
                    ref.refTuple('attachments.createdAt', 'attachments.id'),
                  ),
                ),
            ),
          ),
        ]),
      );

    if (pagination.query) {
      query = query.where(
        sql`f_unaccent(file_name)`,
        'ilike',
        sql`f_unaccent(${'%' + pagination.query + '%'})`,
      );
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  withCreator(eb: ExpressionBuilder<DB, 'attachments'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'attachments.creatorId'),
    ).as('creator');
  }

  async findByIds(
    ids: string[],
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment[]> {
    if (ids.length === 0) return [];
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('id', 'in', ids)
      .execute();
  }

  async findByAiChatId(
    aiChatId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment[]> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('aiChatId', '=', aiChatId)
      .execute();
  }

  async findByTemplateId(
    templateId: string,
    opts?: {
      trx?: KyselyTransaction;
    },
  ): Promise<Attachment[]> {
    const db = dbOrTx(this.db, opts?.trx);

    return db
      .selectFrom('attachments')
      .select(this.baseFields)
      .where('templateId', '=', templateId)
      .execute();
  }

  async updateAttachmentsByTemplateId(
    updatable: UpdatableAttachment,
    templateId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .updateTable('attachments')
      .set(updatable)
      .where('templateId', '=', templateId)
      .execute();
  }

  updateAttachmentsByPageId(
    updatableAttachment: UpdatableAttachment,
    pageIds: string[],
    trx?: KyselyTransaction,
  ) {
    return dbOrTx(this.db, trx)
      .updateTable('attachments')
      .set(updatableAttachment)
      .where('pageId', 'in', pageIds)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async updateAttachment(
    updatableAttachment: UpdatableAttachment,
    attachmentId: string,
  ): Promise<Attachment> {
    return await this.db
      .updateTable('attachments')
      .set(updatableAttachment)
      .where('id', '=', attachmentId)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async claimAttachmentsForChat(
    attachmentIds: string[],
    aiChatId: string,
    creatorId: string,
    workspaceId: string,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;

    await this.db
      .updateTable('attachments')
      .set({ aiChatId })
      .where('id', 'in', attachmentIds)
      .where('creatorId', '=', creatorId)
      .where('workspaceId', '=', workspaceId)
      .where('type', '=', AttachmentType.Chat)
      .where('aiChatId', 'is', null)
      .execute();
  }

  async deleteAttachmentById(attachmentId: string): Promise<void> {
    await this.db
      .deleteFrom('attachments')
      .where('id', '=', attachmentId)
      .executeTakeFirst();
  }

  async deleteAttachmentByFilePath(attachmentFilePath: string): Promise<void> {
    await this.db
      .deleteFrom('attachments')
      .where('filePath', '=', attachmentFilePath)
      .executeTakeFirst();
  }
}
