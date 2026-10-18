import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { ExpressionBuilder, sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx, executeTx } from '../../utils';
import { PageDraft, UpdatablePageDraft } from '@docmost/db/types/entity.types';
import { DB } from '@docmost/db/types/db';
import { jsonToText } from '../../../collaboration/collaboration.util';

@Injectable()
export class PageDraftRepo {
  private readonly logger = new Logger(PageDraftRepo.name);

  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof PageDraft> = [
    'id',
    'pageId',
    'workspaceId',
    'title',
    'icon',
    'lastUpdatedById',
    'contributorIds',
    'createdAt',
    'updatedAt',
  ];

  // Same order as the select in selectPageState.
  private copiedColumns = [
    'pageId',
    'workspaceId',
    'content',
    'ydoc',
    'lastUpdatedById',
    'contributorIds',
  ] as const;

  async findByPageId(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      includeYdoc?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<PageDraft | undefined> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pageDrafts')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .$if(opts?.includeYdoc, (qb) => qb.select('ydoc'))
      .where('pageId', '=', pageId);

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    return query.executeTakeFirst();
  }

  // Locks the page row; the Yjs state moves from the page to the draft.
  async createFromPage(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<PageDraft> {
    return executeTx(
      this.db,
      async (tx) => {
        await tx
          .selectFrom('pages')
          .select('id')
          .where('id', '=', pageId)
          .forUpdate()
          .execute();

        await tx
          .insertInto('pageDrafts')
          .columns(this.copiedColumns)
          .expression((eb) =>
            this.selectPageState(eb).where('pages.id', '=', pageId),
          )
          .onConflict((oc) => oc.column('pageId').doNothing())
          .execute();

        await tx
          .updateTable('pages')
          .set({ ydoc: null })
          .where('id', '=', pageId)
          .where('ydoc', 'is not', null)
          .execute();

        return tx
          .selectFrom('pageDrafts')
          .selectAll()
          .where('pageId', '=', pageId)
          .executeTakeFirstOrThrow();
      },
      trx,
    );
  }

  // Includes trashed pages; returns the ids that got a draft.
  async createFromPagesInSpace(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<string[]> {
    await trx
      .selectFrom('pages')
      .select('id')
      .where('spaceId', '=', spaceId)
      .orderBy('id')
      .forUpdate()
      .execute();

    const inserted = await trx
      .insertInto('pageDrafts')
      .columns(this.copiedColumns)
      .expression((eb) =>
        this.selectPageState(eb)
          .where('pages.spaceId', '=', spaceId)
          .where('pages.isBase', '=', false)
          .where(({ not, exists, selectFrom }) =>
            not(
              exists(
                selectFrom('pageDrafts')
                  .select('pageDrafts.id')
                  .whereRef('pageDrafts.pageId', '=', 'pages.id'),
              ),
            ),
          )
          .where(({ not, exists, selectFrom }) =>
            not(
              exists(
                selectFrom('pageVerifications')
                  .select('pageVerifications.id')
                  .whereRef('pageVerifications.pageId', '=', 'pages.id')
                  .where('pageVerifications.type', '=', 'qms'),
              ),
            ),
          ),
      )
      .onConflict((oc) => oc.column('pageId').doNothing())
      .returning('pageId')
      .execute();

    const pageIds = inserted.map((row) => row.pageId);
    if (pageIds.length === 0) return pageIds;

    await trx
      .updateTable('pages')
      .set({ ydoc: null })
      .where('id', '=', sql<string>`any(${pageIds}::uuid[])`)
      .where('ydoc', 'is not', null)
      .execute();

    return pageIds;
  }

  // UPDATE only: a draft row is created by createFromPage, under the page lock.
  async updateContent(
    pageId: string,
    data: {
      content: any;
      ydoc: Buffer;
      lastUpdatedById: string;
      contributorIds: string[];
    },
    trx?: KyselyTransaction,
  ): Promise<number> {
    const result = await dbOrTx(this.db, trx)
      .updateTable('pageDrafts')
      .set({
        content: data.content,
        ydoc: data.ydoc,
        lastUpdatedById: data.lastUpdatedById,
        contributorIds: data.contributorIds,
        updatedAt: new Date(),
      })
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    return Number(result.numUpdatedRows);
  }

  async updateTitleIcon(
    pageId: string,
    data: { title?: string; icon?: string },
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (data.title === undefined && data.icon === undefined) return;

    const changes: UpdatablePageDraft = { updatedAt: new Date() };
    if (data.title !== undefined) changes.title = data.title;
    if (data.icon !== undefined) changes.icon = data.icon;

    await dbOrTx(this.db, trx)
      .updateTable('pageDrafts')
      .set(changes)
      .where('pageId', '=', pageId)
      .execute();
  }

  async clearTitleIcon(pageId: string, trx?: KyselyTransaction): Promise<void> {
    await dbOrTx(this.db, trx)
      .updateTable('pageDrafts')
      .set({ title: null, icon: null, updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .execute();
  }

  // The caller holds the page row lock; the Yjs state moves back to the page.
  async copyBackToPage(pageId: string, trx: KyselyTransaction): Promise<void> {
    const draft = await trx
      .selectFrom('pageDrafts')
      .select('content')
      .where('pageId', '=', pageId)
      .executeTakeFirst();
    if (!draft) return;

    let textContent: string | null = null;
    if (draft.content) {
      try {
        textContent = jsonToText(draft.content as any);
      } catch (err) {
        this.logger.warn(`jsonToText failed for page ${pageId}: ${err?.['message']}`);
      }
    }

    await trx
      .updateTable('pages')
      .from('pageDrafts')
      .set((eb) => ({
        content: eb.ref('pageDrafts.content'),
        textContent,
        title: eb.fn.coalesce('pageDrafts.title', 'pages.title'),
        icon: eb.fn.coalesce('pageDrafts.icon', 'pages.icon'),
        ydoc: eb.ref('pageDrafts.ydoc'),
        updatedAt: new Date(),
      }))
      .whereRef('pageDrafts.pageId', '=', 'pages.id')
      .where('pages.id', '=', pageId)
      .execute();

    await this.deleteByPageId(pageId, trx);
  }

  // The caller copies the draft's ydoc back to the page first.
  async deleteByPageId(pageId: string, trx?: KyselyTransaction): Promise<void> {
    await dbOrTx(this.db, trx)
      .deleteFrom('pageDrafts')
      .where('pageId', '=', pageId)
      .execute();
  }

  private selectPageState(eb: ExpressionBuilder<DB, 'pageDrafts'>) {
    return eb
      .selectFrom('pages')
      .select((pe) => [
        'pages.id',
        'pages.workspaceId',
        'pages.content',
        'pages.ydoc',
        'pages.lastUpdatedById',
        pe.fn
          .coalesce('pages.contributorIds', sql<string[]>`'{}'::uuid[]`)
          .as('contributorIds'),
      ]);
  }
}
