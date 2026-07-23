import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx, executeTx } from '../../utils';
import {
  InsertablePageHistory,
  Page,
  PageHistory,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import {
  HISTORY_FAST_INTERVAL,
  HISTORY_FAST_THRESHOLD,
  HISTORY_INTERVAL,
} from '../../../collaboration/constants';

@Injectable()
export class PageHistoryRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageHistory> = [
    'id',
    'pageId',
    'slugId',
    'title',
    'icon',
    'coverPhoto',
    'lastUpdatedById',
    'contributorIds',
    'spaceId',
    'workspaceId',
    'createdAt',
    'isEncrypted',
  ];

  async findById(
    pageHistoryId: string,
    opts?: {
      includeContent?: boolean;
      includeEncryptedBlob?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .$if(opts?.includeEncryptedBlob, (qb) => qb.select('encryptedBlob'))
      .select((eb) => this.withLastUpdatedBy(eb))
      .select((eb) => this.withContributors(eb))
      .where('id', '=', pageHistoryId)
      .executeTakeFirst();
  }

  async insertPageHistory(
    insertablePageHistory: InsertablePageHistory,
    trx?: KyselyTransaction,
  ): Promise<PageHistory> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pageHistory')
      .values(insertablePageHistory)
      .returningAll()
      .executeTakeFirst();
  }

  async saveHistory(
    page: Page,
    opts?: { contributorIds?: string[]; trx?: KyselyTransaction },
  ): Promise<void> {
    await executeTx(
      this.db,
      async (trx) => {
        // Re-check encryption state under a row lock: the caller's `page`
        // may be stale, and a concurrent encrypt-conversion must never race
        // a plaintext snapshot back into page_history after its purge.
        const current = await trx
          .selectFrom('pages')
          .select(['isEncrypted'])
          .where('id', '=', page.id)
          .forUpdate()
          .executeTakeFirst();

        if (!current || current.isEncrypted) {
          return;
        }

        await this.insertPageHistory(
          {
            pageId: page.id,
            slugId: page.slugId,
            title: page.title,
            content: page.content,
            icon: page.icon,
            coverPhoto: page.coverPhoto,
            lastUpdatedById: page.lastUpdatedById ?? page.creatorId,
            contributorIds: opts?.contributorIds,
            spaceId: page.spaceId,
            workspaceId: page.workspaceId,
          },
          trx,
        );
      },
      opts?.trx,
    );
  }

  /**
   * Snapshot an E2E-encrypted page. The ciphertext is opaque, so unlike
   * saveHistory this cannot skip unchanged documents (a fresh IV per save
   * makes identical documents produce different bytes) — the interval is the
   * only throttle, and it is checked under the same row lock so concurrent
   * savers serialize on it. Returns how long until the next snapshot is due
   * (relative, so client clock skew cannot make it snapshot on every save)
   * and whether a row was actually written — the client needs the latter to
   * know its newest content is still unsnapshotted.
   */
  async saveEncryptedHistory(
    page: Page,
    snapshot: {
      encryptedBlob: Buffer;
      version: number;
      title: string;
      lastUpdatedById: string;
      contributorIds: string[];
    },
  ): Promise<{ nextSnapshotInMs: number; snapshotSaved: boolean }> {
    // young pages snapshot more often, mirroring the plaintext collab path
    const pageAge = Date.now() - new Date(page.createdAt).getTime();
    const interval =
      pageAge < HISTORY_FAST_THRESHOLD
        ? HISTORY_FAST_INTERVAL
        : HISTORY_INTERVAL;

    return executeTx(this.db, async (trx) => {
      const current = await trx
        .selectFrom('pages')
        .select(['isEncrypted'])
        .where('id', '=', page.id)
        .forUpdate()
        .executeTakeFirst();

      // a decrypt racing this insert must not leave an orphan encrypted
      // snapshot behind on a now-plaintext page
      if (!current?.isEncrypted) {
        return { nextSnapshotInMs: interval, snapshotSaved: false };
      }

      const last = await this.findPageLastHistory(page.id, { trx });
      const lastAt = last ? new Date(last.createdAt).getTime() : null;

      if (lastAt !== null && Date.now() - lastAt < interval) {
        return {
          nextSnapshotInMs: Math.max(0, lastAt + interval - Date.now()),
          snapshotSaved: false,
        };
      }

      await this.insertPageHistory(
        {
          pageId: page.id,
          slugId: page.slugId,
          title: snapshot.title,
          icon: page.icon,
          coverPhoto: page.coverPhoto,
          isEncrypted: true,
          encryptedBlob: snapshot.encryptedBlob,
          // deliberately no encryptionMeta: snapshots are decrypted with the
          // page's current DEK, so a copy of the wrap material here is unused
          // — and after a password change it would keep a DEK wrapped under
          // the *old* password recoverable from every historic row
          version: snapshot.version,
          lastUpdatedById: snapshot.lastUpdatedById,
          contributorIds: snapshot.contributorIds,
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
        },
        trx,
      );

      return { nextSnapshotInMs: interval, snapshotSaved: true };
    });
  }

  async findPageHistoryByPageId(pageId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .select((eb) => this.withLastUpdatedBy(eb))
      .select((eb) => this.withContributors(eb))
      .where('pageId', '=', pageId);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });
  }

  async findPageLastHistory(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      trx?: KyselyTransaction;
    },
  ) {
    const db = dbOrTx(this.db, opts?.trx);

    return await db
      .selectFrom('pageHistory')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .where('pageId', '=', pageId)
      .limit(1)
      .orderBy('createdAt', 'desc')
      .executeTakeFirst();
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pageHistory.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pageHistory'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef(
          'users.id',
          '=',
          sql`ANY(${eb.ref('pageHistory.contributorIds')})`,
        ),
    ).as('contributors');
  }
}
