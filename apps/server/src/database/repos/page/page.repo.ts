import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx, executeTx } from '../../utils';
import {
  InsertablePage,
  Page,
  UpdatablePage,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { validate as isValidUUID } from 'uuid';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventName } from '../../../common/events/event.contants';
import { MAX_ENCRYPTED_TREE_PAGES } from '../../../core/page/page-encryption.util';

@Injectable()
export class PageRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private spaceMemberRepo: SpaceMemberRepo,
    private eventEmitter: EventEmitter2,
  ) {}

  private baseFields: Array<keyof Page> = [
    'id',
    'slugId',
    'title',
    'icon',
    'coverPhoto',
    'position',
    'parentPageId',
    'creatorId',
    'lastUpdatedById',
    'spaceId',
    'workspaceId',
    'isLocked',
    'isBase',
    'isEncrypted',
    'encryptionMeta',
    'encryptionRootId',
    'encryptedById',
    'encryptedVersion',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'contributorIds',
  ];

  async findById(
    pageId: string,
    opts?: {
      includeContent?: boolean;
      includeTextContent?: boolean;
      includeYdoc?: boolean;
      includeEncryptedBlob?: boolean;
      includeSpace?: boolean;
      includeCreator?: boolean;
      includeLastUpdatedBy?: boolean;
      includeContributors?: boolean;
      includeDeletedBy?: boolean;
      includeHasChildren?: boolean;
      withLock?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<Page> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pages')
      .select(this.baseFields)
      .$if(opts?.includeContent, (qb) => qb.select('content'))
      .$if(opts?.includeYdoc, (qb) => qb.select('ydoc'))
      .$if(opts?.includeTextContent, (qb) => qb.select('textContent'))
      .$if(opts?.includeEncryptedBlob, (qb) => qb.select('encryptedBlob'))
      .$if(opts?.includeHasChildren, (qb) =>
        qb.select((eb) => this.withHasChildren(eb)),
      );

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    if (opts?.includeLastUpdatedBy) {
      query = query.select((eb) => this.withLastUpdatedBy(eb));
    }

    if (opts?.includeContributors) {
      query = query.select((eb) => this.withContributors(eb));
    }

    if (opts?.includeDeletedBy) {
      query = query.select((eb) => this.withDeletedBy(eb));
    }

    if (opts?.includeSpace) {
      query = query.select((eb) => this.withSpace(eb));
    }

    if (opts?.withLock && opts?.trx) {
      query = query.forUpdate();
    }

    if (isValidUUID(pageId)) {
      query = query.where('id', '=', pageId);
    } else {
      query = query.where('slugId', '=', pageId);
    }

    return query.executeTakeFirst();
  }

  async findManyByIds(
    pageIds: string[],
    opts?: {
      trx?: KyselyTransaction;
      workspaceId?: string;
    },
  ): Promise<Page[]> {
    if (pageIds.length === 0) return [];
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('pages')
      .select(this.baseFields)
      .where('id', 'in', pageIds);

    if (opts?.workspaceId) {
      query = query
        .where('workspaceId', '=', opts.workspaceId)
        .where('deletedAt', 'is', null);
    }

    return query.execute();
  }

  async updatePage(
    updatablePage: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    return this.updatePages(updatablePage, [pageId], trx);
  }

  async updatePages(
    updatePageData: UpdatablePage,
    pageIds: string[],
    trx?: KyselyTransaction,
  ) {
    const result = await dbOrTx(this.db, trx)
      .updateTable('pages')
      .set({ ...updatePageData, updatedAt: new Date() })
      .where(
        pageIds.some((pageId) => !isValidUUID(pageId)) ? 'slugId' : 'id',
        'in',
        pageIds,
      )
      .executeTakeFirst();

    this.eventEmitter.emit(EventName.PAGE_UPDATED, {
      pageIds: pageIds,
      workspaceId: updatePageData.workspaceId,
    });

    return result;
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .insertInto('pages')
      .values(insertablePage)
      .returning(this.baseFields)
      .executeTakeFirst();

    this.eventEmitter.emit(EventName.PAGE_CREATED, {
      pageIds: [result.id],
      workspaceId: result.workspaceId,
    });

    return result;
  }

  async deletePage(pageId: string): Promise<void> {
    let query = this.db.deleteFrom('pages');

    if (isValidUUID(pageId)) {
      query = query.where('id', '=', pageId);
    } else {
      query = query.where('slugId', '=', pageId);
    }

    await query.execute();
  }

  async removePage(
    pageId: string,
    deletedById: string,
    workspaceId: string,
  ): Promise<void> {
    const currentDate = new Date();

    const descendants = await this.db
      .withRecursive('page_descendants', (db) =>
        db
          .selectFrom('pages')
          .select(['id'])
          .where('id', '=', pageId)
          .where('deletedAt', 'is', null)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id'])
              .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId')
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_descendants')
      .selectAll()
      .execute();

    const pageIds = descendants.map((d) => d.id);

    if (pageIds.length > 0) {
      await executeTx(this.db, async (trx) => {
        await trx
          .updateTable('pages')
          .set({
            deletedById: deletedById,
            deletedAt: currentDate,
          })
          .where('id', 'in', pageIds)
          .where('deletedAt', 'is', null)
          .execute();

        await trx.deleteFrom('shares').where('pageId', 'in', pageIds).execute();
      });

      this.eventEmitter.emit(EventName.PAGE_SOFT_DELETED, {
        pageIds: pageIds,
        workspaceId,
      });
    }
  }

  async restorePage(pageId: string, workspaceId: string): Promise<void> {
    // First, check if the page being restored has a deleted parent
    const pageToRestore = await this.db
      .selectFrom('pages')
      .select(['id', 'parentPageId', 'encryptionRootId'])
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!pageToRestore) {
      return;
    }

    // Check if the parent is also deleted
    let shouldDetachFromParent = false;
    if (pageToRestore.parentPageId) {
      const parent = await this.db
        .selectFrom('pages')
        .select(['id', 'deletedAt'])
        .where('id', '=', pageToRestore.parentPageId)
        .executeTakeFirst();

      // If parent is deleted, we should detach this page from it
      shouldDetachFromParent = parent?.deletedAt !== null;
    }

    // A page keyed to an encrypted section must never be detached to the space
    // root: it would sit outside the section that holds its key, and — because
    // it still references that root — it would block the eventual hard delete
    // of the root during trash cleanup. Re-attach it to the root instead.
    let reattachToPageId: string | null = null;
    if (shouldDetachFromParent && pageToRestore.encryptionRootId) {
      const encryptionRoot = await this.db
        .selectFrom('pages')
        .select(['id', 'deletedAt'])
        .where('id', '=', pageToRestore.encryptionRootId)
        .executeTakeFirst();

      if (!encryptionRoot || encryptionRoot.deletedAt) {
        throw new BadRequestException(
          'This page belongs to an encrypted section whose main page is in the trash. Restore that page instead.',
        );
      }

      reattachToPageId = encryptionRoot.id;
    }

    // Find all descendants to restore
    const pages = await this.db
      .withRecursive('page_descendants', (db) =>
        db
          .selectFrom('pages')
          .select(['id'])
          .where('id', '=', pageId)
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select(['p.id'])
              .innerJoin('page_descendants as pd', 'pd.id', 'p.parentPageId'),
          ),
      )
      .selectFrom('page_descendants')
      .selectAll()
      .execute();

    const pageIds = pages.map((p) => p.id);

    // Restore all pages, but only detach the root page if its parent is deleted
    await this.db
      .updateTable('pages')
      .set({ deletedById: null, deletedAt: null })
      .where('id', 'in', pageIds)
      .execute();

    // If we need to detach the restored page from its deleted parent
    if (shouldDetachFromParent) {
      await this.db
        .updateTable('pages')
        .set({ parentPageId: reattachToPageId })
        .where('id', '=', pageId)
        .execute();
    }
    this.eventEmitter.emit(EventName.PAGE_RESTORED, {
      pageIds: pageIds,
      workspaceId: workspaceId,
    });
  }

  async getRecentPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'updatedAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
  }

  async getRecentPages(userId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(userId))
      .where('deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'updatedAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
  }

  async getCreatedByPages(
    creatorId: string,
    requestingUserId: string,
    pagination: PaginationOptions,
    spaceId?: string,
  ) {
    let query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select((eb) => this.withSpace(eb))
      .where('creatorId', '=', creatorId)
      .where('deletedAt', 'is', null);

    if (spaceId) {
      query = query.where('spaceId', '=', spaceId);
    } else {
      query = query.where(
        'spaceId',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(requestingUserId),
      );
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'updatedAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        updatedAt: new Date(cursor.updatedAt),
        id: cursor.id,
      }),
    });
  }

  async getDeletedPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .select('content')
      .select((eb) => this.withSpace(eb))
      .select((eb) => this.withDeletedBy(eb))
      .where('spaceId', '=', spaceId)
      .where('deletedAt', 'is not', null)
      // Only include pages that are either root pages (no parent) or whose parent is not deleted
      // This prevents showing orphaned pages when their parent has been soft-deleted
      .where((eb) =>
        eb.or([
          eb('parentPageId', 'is', null),
          eb.not(
            eb.exists(
              eb
                .selectFrom('pages as parent')
                .select('parent.id')
                .where('parent.id', '=', eb.ref('pages.parentPageId'))
                .where('parent.deletedAt', 'is not', null),
            ),
          ),
        ]),
      );

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'deletedAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        deletedAt: new Date(cursor.deletedAt),
        id: cursor.id,
      }),
    });
  }

  withSpace(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('spaces')
        .select(['spaces.id', 'spaces.name', 'spaces.slug'])
        .whereRef('spaces.id', '=', 'pages.spaceId'),
    ).as('space');
  }

  withCreator(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.creatorId'),
    ).as('creator');
  }

  withLastUpdatedBy(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.lastUpdatedById'),
    ).as('lastUpdatedBy');
  }

  withDeletedBy(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'pages.deletedById'),
    ).as('deletedBy');
  }

  withContributors(eb: ExpressionBuilder<DB, 'pages'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.avatarUrl'])
        .whereRef('users.id', '=', sql`ANY(${eb.ref('pages.contributorIds')})`),
    ).as('contributors');
  }

  withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
    return eb
      .selectFrom('pages as child')
      .select((eb) =>
        eb
          .case()
          .when(eb.fn.countAll(), '>', 0)
          .then(true)
          .else(false)
          .end()
          .as('count'),
      )
      .whereRef('child.parentPageId', '=', 'pages.id')
      .where('child.deletedAt', 'is', null)
      .limit(1)
      .as('hasChildren');
  }

  async getPageAndDescendants(
    parentPageId: string,
    opts: {
      includeContent: boolean;
      includeEncryption?: boolean;
      /**
       * Include soft-deleted pages. Encryption conversions need this: a page
       * sitting in the trash still belongs to the section, and skipping it
       * would leave its plaintext behind (or, on decrypt, strand its
       * ciphertext with no reachable key once it is restored).
       */
      includeDeleted?: boolean;
    },
  ) {
    return this.db
      .withRecursive('page_hierarchy', (db) =>
        db
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'title',
            'icon',
            'position',
            'parentPageId',
            'spaceId',
            'workspaceId',
            'createdAt',
            'updatedAt',
            'isEncrypted',
            'encryptionRootId',
          ])
          .$if(opts?.includeContent, (qb) => qb.select('content'))
          .$if(opts?.includeEncryption, (qb) =>
            qb.select([
              'encryptedBlob',
              'encryptionMeta',
              'encryptedById',
              'encryptedVersion',
            ]),
          )
          .where('id', '=', parentPageId)
          .$if(!opts?.includeDeleted, (qb) => qb.where('deletedAt', 'is', null))
          .unionAll((exp) =>
            exp
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.icon',
                'p.position',
                'p.parentPageId',
                'p.spaceId',
                'p.workspaceId',
                'p.createdAt',
                'p.updatedAt',
                'p.isEncrypted',
                'p.encryptionRootId',
              ])
              .$if(opts?.includeContent, (qb) => qb.select('p.content'))
              .$if(opts?.includeEncryption, (qb) =>
                qb.select([
                  'p.encryptedBlob',
                  'p.encryptionMeta',
                  'p.encryptedById',
                  'p.encryptedVersion',
                ]),
              )
              .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id')
              .$if(!opts?.includeDeleted, (qb) =>
                qb.where('p.deletedAt', 'is', null),
              ),
          ),
      )
      .selectFrom('page_hierarchy')
      .selectAll()
      .execute();
  }

  /**
   * Get page and all descendants, excluding restricted pages and their subtrees.
   * More efficient than getPageAndDescendants + filtering because:
   * 1. Single DB query (no separate restricted IDs query)
   * 2. Stops traversing at restricted pages (doesn't fetch data to discard)
   * 3. No in-memory filtering needed
   */
  async getPageAndDescendantsExcludingRestricted(
    parentPageId: string,
    opts: { includeContent: boolean },
  ) {
    return (
      this.db
        .withRecursive('page_hierarchy', (db) =>
          db
            .selectFrom('pages')
            .leftJoin('pageAccess', 'pageAccess.pageId', 'pages.id')
            .select([
              'pages.id',
              'pages.slugId',
              'pages.title',
              'pages.icon',
              'pages.position',
              'pages.parentPageId',
              'pages.spaceId',
              'pages.workspaceId',
              'pages.isEncrypted',
              sql<boolean>`page_access.id IS NOT NULL`.as('isRestricted'),
            ])
            .$if(opts?.includeContent, (qb) => qb.select('pages.content'))
            .where('pages.id', '=', parentPageId)
            .where('pages.deletedAt', 'is', null)
            .unionAll((exp) =>
              exp
                .selectFrom('pages as p')
                .innerJoin('page_hierarchy as ph', 'p.parentPageId', 'ph.id')
                .leftJoin('pageAccess', 'pageAccess.pageId', 'p.id')
                .select([
                  'p.id',
                  'p.slugId',
                  'p.title',
                  'p.icon',
                  'p.position',
                  'p.parentPageId',
                  'p.spaceId',
                  'p.workspaceId',
                  'p.isEncrypted',
                  sql<boolean>`page_access.id IS NOT NULL`.as('isRestricted'),
                ])
                .$if(opts?.includeContent, (qb) => qb.select('p.content'))
                .where('p.deletedAt', 'is', null)
                // Only recurse into children of non-restricted pages
                .where('ph.isRestricted', '=', false),
            ),
        )
        .selectFrom('page_hierarchy')
        .select([
          'id',
          'slugId',
          'title',
          'icon',
          'position',
          'parentPageId',
          'spaceId',
          'workspaceId',
          'isEncrypted',
        ])
        .$if(opts?.includeContent, (qb) => qb.select('content'))
        // Filter out restricted pages from the result
        .where('isRestricted', '=', false)
        .execute()
    );
  }

  /**
   * How many pages the encrypted section rooted at this page holds, the root
   * itself included. Counts soft-deleted pages too: they still hold ciphertext
   * keyed to this root, so they still have to fit in a decrypt request.
   *
   * Inside a transaction the root row is locked first, which is what makes the
   * count usable as a capacity check: without it two requests adding pages to
   * the same section can both read the same count and both decide they fit.
   */
  async countEncryptionSection(
    rootPageId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);

    if (trx) {
      await trx
        .selectFrom('pages')
        .select('id')
        .where('id', '=', rootPageId)
        .forUpdate()
        .execute();
    }

    const { count } = await db
      .selectFrom('pages')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where((eb) =>
        eb.or([
          eb('id', '=', rootPageId),
          eb('encryptionRootId', '=', rootPageId),
        ]),
      )
      .executeTakeFirst();

    return Number(count);
  }

  /**
   * Refuse to grow an encrypted section past the size one request can convert.
   *
   * A section is encrypted and decrypted as a whole, in a single request each
   * way, carrying one blob per page — so it is capped at
   * MAX_ENCRYPTED_TREE_PAGES. A section allowed past that cap by any other
   * route is trapped: still perfectly readable, but impossible to ever decrypt
   * through the API again. Every path that adds pages to an existing section
   * goes through here — creating a page, duplicating a subtree, and converting
   * a subtree into an existing section.
   */
  async assertSectionHasRoom(
    encryptionRootId: string,
    additionalPages: number,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const current = await this.countEncryptionSection(encryptionRootId, trx);
    if (current + additionalPages > MAX_ENCRYPTED_TREE_PAGES) {
      throw new BadRequestException(
        `An encrypted section cannot hold more than ${MAX_ENCRYPTED_TREE_PAGES} pages.`,
      );
    }
  }
}
