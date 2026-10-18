import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableSpace,
  Space,
  UpdatableSpace,
} from '@docmost/db/types/entity.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { DB } from '@docmost/db/types/db';
import { validate as isValidUUID } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';

@Injectable()
export class SpaceRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private eventEmitter: EventEmitter2,
  ) {}

  async findById(
    spaceId: string,
    workspaceId: string,
    opts?: {
      includeMemberCount?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Space> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('spaces')
      .selectAll('spaces')
      .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
      .select((eb) => this.withIsPublished(eb))
      .where('workspaceId', '=', workspaceId);

    if (isValidUUID(spaceId)) {
      query = query.where('id', '=', spaceId);
    } else {
      query = query.where(sql`LOWER(slug)`, '=', sql`LOWER(${spaceId})`);
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    return query.executeTakeFirst();
  }

  async findBySlug(
    slug: string,
    workspaceId: string,
    opts?: { includeMemberCount: boolean },
  ): Promise<Space> {
    return await this.db
      .selectFrom('spaces')
      .selectAll('spaces')
      .$if(opts?.includeMemberCount, (qb) => qb.select(this.withMemberCount))
      .select((eb) => this.withIsPublished(eb))
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findPersonalSpace(
    userId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Space | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('spaces')
      .selectAll('spaces')
      .where('workspaceId', '=', workspaceId)
      .where('creatorId', '=', userId)
      .where('isPersonal', '=', true)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async slugExists(
    slug: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<boolean> {
    const db = dbOrTx(this.db, trx);
    let { count } = await db
      .selectFrom('spaces')
      .select((eb) => eb.fn.count('id').as('count'))
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    count = count as number;
    return count != 0;
  }

  async updateSpace(
    updatableSpace: UpdatableSpace,
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({ ...updatableSpace, updatedAt: new Date() })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  async updateSharingSettings(
    spaceId: string,
    workspaceId: string,
    prefKey: string,
    prefValue: string | boolean,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('sharing', COALESCE(settings->'sharing', '{}'::jsonb)
          || jsonb_build_object('${sql.raw(prefKey)}', ${sql.lit(prefValue)}))`,
        updatedAt: new Date(),
      })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  async updateCommentSettings(
    spaceId: string,
    workspaceId: string,
    prefKey: string,
    prefValue: string | boolean,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('comments', COALESCE(settings->'comments', '{}'::jsonb)
          || jsonb_build_object('${sql.raw(prefKey)}', ${sql.lit(prefValue)}))`,
        updatedAt: new Date(),
      })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  // Writing settled settings also drops a leftover disabling flag.
  async updateApprovalSettings(
    spaceId: string,
    workspaceId: string,
    settings: {
      enabled: boolean;
      approverIds: string[];
      enabledAt?: string;
      enabledById?: string;
    },
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('approval', (${this.approvalSettingsSql()} - 'disabling')
          || ${JSON.stringify(settings)}::text::jsonb)`,
        updatedAt: new Date(),
      })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  // Space approval stays in force until the disable run clears this flag.
  async markApprovalDisabling(
    spaceId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('spaces')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('approval', ${this.approvalSettingsSql()} || '{"disabling": true}'::jsonb)`,
        updatedAt: new Date(),
      })
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
  }

  // Trashed pages included; pages with their own approval row keep it.
  async findApprovalPagesToRelease(
    spaceId: string,
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const rows = await dbOrTx(this.db, trx)
      .selectFrom('pages')
      .select('pages.id')
      .where('pages.spaceId', '=', spaceId)
      .where('pages.isBase', '=', false)
      .where(({ and, or, not, exists, selectFrom }) =>
        and([
          not(
            exists(
              selectFrom('pageVerifications')
                .select('pageVerifications.id')
                .whereRef('pageVerifications.pageId', '=', 'pages.id')
                .where('pageVerifications.type', '=', 'qms')
                .where('pageVerifications.source', '<>', 'space'),
            ),
          ),
          or([
            exists(
              selectFrom('pageDrafts')
                .select('pageDrafts.id')
                .whereRef('pageDrafts.pageId', '=', 'pages.id'),
            ),
            exists(
              selectFrom('pageVerifications')
                .select('pageVerifications.id')
                .whereRef('pageVerifications.pageId', '=', 'pages.id')
                .where('pageVerifications.type', '=', 'qms')
                .where('pageVerifications.source', '=', 'space'),
            ),
          ]),
        ]),
      )
      .orderBy('pages.id')
      .execute();

    return rows.map((row) => row.id);
  }

  // Only the approval pointer changes: no updated_at bump.
  async clearUncontrolledReaderVersions(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<number> {
    const result = await trx
      .updateTable('pages')
      .set({ readerVersionId: null })
      .where('spaceId', '=', spaceId)
      .where('readerVersionId', 'is not', null)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('pageVerifications')
              .select('pageVerifications.id')
              .whereRef('pageVerifications.pageId', '=', 'pages.id')
              .where('pageVerifications.type', '=', 'qms'),
          ),
        ),
      )
      .executeTakeFirst();

    return Number(result.numUpdatedRows);
  }

  async findExpiringVerificationPageIds(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<string[]> {
    const rows = await trx
      .selectFrom('pageVerifications')
      .innerJoin('pages', 'pages.id', 'pageVerifications.pageId')
      .select('pageVerifications.pageId')
      .where('pages.spaceId', '=', spaceId)
      .where('pages.isBase', '=', false)
      .where('pageVerifications.type', '=', 'expiring')
      .execute();

    return rows.map((row) => row.pageId);
  }

  // Deletes only the approvers; each approval row keeps its source.
  async removeQmsPageApprovers(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<Array<{ pageId: string; userId: string }>> {
    return trx
      .deleteFrom('pageVerifiers')
      .using(['pageVerifications', 'pages'])
      .whereRef('pageVerifications.id', '=', 'pageVerifiers.pageVerificationId')
      .whereRef('pages.id', '=', 'pageVerifications.pageId')
      .where('pages.spaceId', '=', spaceId)
      .where('pages.isBase', '=', false)
      .where('pageVerifications.type', '=', 'qms')
      .returning(['pageVerifications.pageId', 'pageVerifiers.userId'])
      .execute();
  }

  async insertSpace(
    insertableSpace: InsertableSpace,
    trx?: KyselyTransaction,
  ): Promise<Space> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('spaces')
      .values(insertableSpace)
      .returningAll()
      .executeTakeFirst();
  }

  async getSpacesInWorkspace(
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    // todo: show spaces user have access based on visibility and memberships
    let query = this.db
      .selectFrom('spaces')
      .selectAll('spaces')
      .select((eb) => [this.withMemberCount(eb)])
      .select((eb) => this.withIsPublished(eb))
      .where('workspaceId', '=', workspaceId);

    if (pagination.query) {
      query = query.where((eb) =>
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

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'name', direction: 'asc' },
        { expression: 'id', direction: 'asc' },
      ],
      parseCursor: (cursor) => ({ name: cursor.name, id: cursor.id }),
    });
  }

  withMemberCount(eb: ExpressionBuilder<DB, 'spaces'>) {
    const subquery = eb
      .selectFrom('spaceMembers')
      .select('spaceMembers.userId')
      .where('spaceMembers.userId', 'is not', null)
      .whereRef('spaceMembers.spaceId', '=', 'spaces.id')
      .union(
        eb
          .selectFrom('spaceMembers')
          .where('spaceMembers.groupId', 'is not', null)
          .leftJoin('groups', 'groups.id', 'spaceMembers.groupId')
          .leftJoin('groupUsers', 'groupUsers.groupId', 'groups.id')
          .select('groupUsers.userId')
          .whereRef('spaceMembers.spaceId', '=', 'spaces.id'),
      )
      .as('userId');

    return eb
      .selectFrom(subquery)
      .select((eb) => eb.fn.count('userId').as('count'))
      .as('memberCount');
  }

  // The approval object, or {} when it is missing or not an object.
  private approvalSettingsSql() {
    return sql`CASE WHEN jsonb_typeof(settings->'approval') = 'object' THEN settings->'approval' ELSE '{}'::jsonb END`;
  }

  withIsPublished(eb: ExpressionBuilder<DB, 'spaces'>) {
    return eb
      .exists(
        eb
          .selectFrom('publicSpaces')
          .select('publicSpaces.id')
          .whereRef('publicSpaces.spaceId', '=', 'spaces.id')
          .where('publicSpaces.enabled', '=', true),
      )
      .as('isPublished');
  }

  async deleteSpace(spaceId: string, workspaceId: string): Promise<void> {
    await this.db
      .deleteFrom('spaces')
      .where('id', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .execute();

    this.eventEmitter.emit(EventName.SPACE_DELETED, {
      spaceId,
      workspaceId,
    });
  }
}
