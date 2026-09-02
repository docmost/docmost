import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { createCache } from 'cache-manager';
import { PageService } from '../src/core/page/services/page.service';
import { TrashCleanupService } from '../src/core/page/services/trash-cleanup.service';
import { ShareService } from '../src/core/share/share.service';
import { PageHierarchyCycleError } from '../src/database/helpers/page-hierarchy-cycle';
import { PagePermissionRepo } from '../src/database/repos/page/page-permission.repo';
import { PageRepo } from '../src/database/repos/page/page.repo';
import { KyselyDB } from '../src/database/types/kysely.types';
import { db, withStatementTimeout } from './support/database';
import {
  seedAcyclicPageChain,
  seedBranchingDescendantTree,
  seedSelfCycle,
  seedTwoPageCycle,
} from './support/page-hierarchy-fixtures';

function createPageService(
  connection: KyselyDB,
  dependencies: {
    attachmentQueue?: { add: jest.Mock };
    eventEmitter?: { emit: jest.Mock };
  } = {},
): PageService {
  return new PageService(
    undefined as never,
    undefined as never,
    undefined as never,
    connection,
    undefined as never,
    dependencies.attachmentQueue as never,
    undefined as never,
    undefined as never,
    dependencies.eventEmitter as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
}

function createPageRepo(
  connection: KyselyDB,
  eventEmitter: { emit: jest.Mock } = { emit: jest.fn() },
): PageRepo {
  return new PageRepo(connection, undefined as never, eventEmitter as never);
}

function createShareService(connection: KyselyDB): ShareService {
  return new ShareService(
    undefined as never,
    undefined as never,
    undefined as never,
    connection,
    undefined as never,
    undefined as never,
  );
}

function createPagePermissionRepo(connection: KyselyDB): PagePermissionRepo {
  return new PagePermissionRepo(connection, undefined as never, createCache());
}

async function insertTestUser(pageId: string): Promise<string> {
  const { workspaceId } = await db
    .selectFrom('pages')
    .select('workspaceId')
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();

  const user = await db
    .insertInto('users')
    .values({
      email: `cycle-test-${randomUUID()}@example.com`,
      name: 'Page hierarchy test user',
      workspaceId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return user.id;
}

async function insertTwoPageCycleInPageSpace(
  pageId: string,
): Promise<{ cyclePageId: string; spaceId: string }> {
  const context = await db
    .selectFrom('pages')
    .select(['spaceId', 'workspaceId'])
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();
  const a = await db
    .insertInto('pages')
    .values({
      slugId: randomUUID(),
      spaceId: context.spaceId,
      title: 'Same-space cycle A',
      workspaceId: context.workspaceId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const b = await db
    .insertInto('pages')
    .values({
      parentPageId: a.id,
      slugId: randomUUID(),
      spaceId: context.spaceId,
      title: 'Same-space cycle B',
      workspaceId: context.workspaceId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db
    .updateTable('pages')
    .set({ parentPageId: b.id })
    .where('id', '=', a.id)
    .execute();

  return { cyclePageId: a.id, spaceId: context.spaceId };
}

async function restrictPage(
  pageId: string,
  permittedUserId?: string,
): Promise<{
  accessLevel: string;
  pageAccessId: string;
  pageId: string;
}> {
  const page = await db
    .selectFrom('pages')
    .select(['spaceId', 'workspaceId'])
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();
  const pageAccess = await db
    .insertInto('pageAccess')
    .values({
      accessLevel: 'restricted',
      pageId,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    })
    .returning(['accessLevel', 'id', 'pageId'])
    .executeTakeFirstOrThrow();

  if (permittedUserId) {
    await db
      .insertInto('pagePermissions')
      .values({
        pageAccessId: pageAccess.id,
        role: 'writer',
        userId: permittedUserId,
      })
      .execute();
  }

  return {
    accessLevel: pageAccess.accessLevel,
    pageAccessId: pageAccess.id,
    pageId: pageAccess.pageId,
  };
}

async function insertShare(pageId: string, includeSubPages: boolean) {
  const page = await db
    .selectFrom('pages')
    .select(['spaceId', 'workspaceId'])
    .where('id', '=', pageId)
    .executeTakeFirstOrThrow();

  return db
    .insertInto('shares')
    .values({
      includeSubPages,
      key: `cycle-test-${randomUUID()}`,
      pageId,
      searchIndexing: false,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    })
    .returning(['id', 'workspaceId'])
    .executeTakeFirstOrThrow();
}

async function expectPageHierarchyCycle(
  operation: Promise<unknown>,
  rootPageId: string,
): Promise<void> {
  const error = await operation.then(
    () => undefined,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(PageHierarchyCycleError);
  expect(error).toEqual(
    expect.objectContaining({
      code: 'PAGE_HIERARCHY_CYCLE',
      rootPageId,
    }) satisfies Partial<PageHierarchyCycleError>,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('cycle-safe page hierarchy reads', () => {
  describe('descendant traversal', () => {
    it('returns every page in an acyclic branching tree exactly once without internal metadata', async () => {
      const { root, firstChild, secondChild, grandchild } =
        await seedBranchingDescendantTree();
      const repo = createPageRepo(db);

      const pages = await repo.getPageAndDescendants(root.id, {
        includeContent: false,
      });

      expect(pages.map((page) => page.id).sort()).toEqual(
        [root.id, firstChild.id, secondChild.id, grandchild.id].sort(),
      );
      expect(pages).toHaveLength(4);
      for (const page of pages) {
        expect(page).not.toHaveProperty('isCycle');
        expect(page).not.toHaveProperty('traversalPath');
      }
    });

    describe.each([
      ['a self-cycle', async () => (await seedSelfCycle()).self.id],
      ['a two-page cycle', async () => (await seedTwoPageCycle()).a.id],
    ])('%s', (_cycleName, seedCycle) => {
      it('raises PageHierarchyCycleError from the structural descendant read', async () => {
        const pageId = await seedCycle();

        await withStatementTimeout(async (connection) => {
          const repo = createPageRepo(connection);

          await expectPageHierarchyCycle(
            repo.getPageAndDescendants(pageId, { includeContent: false }),
            pageId,
          );
        });
      });

      it('raises PageHierarchyCycleError from the restricted descendant read', async () => {
        const pageId = await seedCycle();

        await withStatementTimeout(async (connection) => {
          const repo = createPageRepo(connection);

          await expectPageHierarchyCycle(
            repo.getPageAndDescendantsExcludingRestricted(pageId, {
              includeContent: false,
            }),
            pageId,
          );
        });
      });
    });

    it('preserves restricted-subtree exclusion for an acyclic tree', async () => {
      const { root, firstChild, secondChild, grandchild } =
        await seedBranchingDescendantTree();
      await restrictPage(firstChild.id);
      const repo = createPageRepo(db);

      const pages = await repo.getPageAndDescendantsExcludingRestricted(
        root.id,
        { includeContent: false },
      );

      expect(pages.map((page) => page.id).sort()).toEqual(
        [root.id, secondChild.id].sort(),
      );
      expect(pages.map((page) => page.id)).not.toContain(firstChild.id);
      expect(pages.map((page) => page.id)).not.toContain(grandchild.id);
      for (const page of pages) {
        expect(page).not.toHaveProperty('isCycle');
        expect(page).not.toHaveProperty('isRestricted');
        expect(page).not.toHaveProperty('traversalPath');
      }
    });

    it('removePage leaves pages and shares unchanged and emits no event on a cycle', async () => {
      const { a, b } = await seedTwoPageCycle();
      const deletedById = await insertTestUser(a.id);
      const share = await insertShare(b.id, true);
      const eventEmitter = { emit: jest.fn() };

      await withStatementTimeout(async (connection) => {
        const repo = createPageRepo(connection, eventEmitter);

        await expectPageHierarchyCycle(
          repo.removePage(a.id, deletedById, share.workspaceId),
          a.id,
        );
      });

      const storedPages = await db
        .selectFrom('pages')
        .select(['id', 'deletedAt', 'deletedById'])
        .where('id', 'in', [a.id, b.id])
        .orderBy('id')
        .execute();
      const storedShare = await db
        .selectFrom('shares')
        .select('id')
        .where('id', '=', share.id)
        .executeTakeFirst();

      expect(storedPages).toEqual(
        [a.id, b.id]
          .sort()
          .map((id) => ({ id, deletedAt: null, deletedById: null })),
      );
      expect(storedShare).toEqual({ id: share.id });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('restorePage leaves deleted pages unchanged and emits no event on a cycle', async () => {
      const { a, b } = await seedTwoPageCycle();
      const deletedAt = new Date('2024-01-02T03:04:05.000Z');
      await db
        .updateTable('pages')
        .set({ deletedAt })
        .where('id', 'in', [a.id, b.id])
        .execute();
      const eventEmitter = { emit: jest.fn() };

      await withStatementTimeout(async (connection) => {
        const repo = createPageRepo(connection, eventEmitter);

        await expectPageHierarchyCycle(
          repo.restorePage(a.id, randomUUID()),
          a.id,
        );
      });

      const storedPages = await db
        .selectFrom('pages')
        .select(['id', 'parentPageId', 'deletedAt'])
        .where('id', 'in', [a.id, b.id])
        .orderBy('id')
        .execute();

      expect(storedPages).toEqual(
        [
          { id: a.id, parentPageId: b.id, deletedAt },
          { id: b.id, parentPageId: a.id, deletedAt },
        ].sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('forceDelete leaves pages intact and enqueues and emits nothing on a cycle', async () => {
      const { a, b } = await seedTwoPageCycle();
      const attachmentQueue = { add: jest.fn() };
      const eventEmitter = { emit: jest.fn() };

      await withStatementTimeout(async (connection) => {
        const pageService = createPageService(connection, {
          attachmentQueue,
          eventEmitter,
        });

        await expectPageHierarchyCycle(
          pageService.forceDelete(a.id, randomUUID()),
          a.id,
        );
      });

      const storedPageIds = await db
        .selectFrom('pages')
        .select('id')
        .where('id', 'in', [a.id, b.id])
        .orderBy('id')
        .execute();

      expect(storedPageIds).toEqual([a.id, b.id].sort().map((id) => ({ id })));
      expect(attachmentQueue.add).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('trash cleanup logs and skips a corrupt root before continuing with acyclic trash', async () => {
      const { self } = await seedSelfCycle();
      const context = await db
        .selectFrom('pages')
        .select(['spaceId', 'workspaceId'])
        .where('id', '=', self.id)
        .executeTakeFirstOrThrow();
      const corruptSideChild = await db
        .insertInto('pages')
        .values({
          parentPageId: self.id,
          slugId: randomUUID(),
          spaceId: context.spaceId,
          title: 'Corrupt side child',
          workspaceId: context.workspaceId,
        })
        .returning(['id', 'parentPageId'])
        .executeTakeFirstOrThrow();
      const healthyRoot = await db
        .insertInto('pages')
        .values({
          slugId: randomUUID(),
          spaceId: context.spaceId,
          title: 'Healthy cleanup root',
          workspaceId: context.workspaceId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const healthyChild = await db
        .insertInto('pages')
        .values({
          parentPageId: healthyRoot.id,
          slugId: randomUUID(),
          spaceId: context.spaceId,
          title: 'Healthy cleanup child',
          workspaceId: context.workspaceId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const expiredAt = new Date('2024-01-02T03:04:05.000Z');
      await db
        .updateTable('pages')
        .set({ deletedAt: expiredAt })
        .where('id', 'in', [
          self.id,
          corruptSideChild.id,
          healthyRoot.id,
          healthyChild.id,
        ])
        .execute();
      const attachmentQueue = { add: jest.fn() };
      const loggerError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      await withStatementTimeout(async (connection) => {
        const timeoutCleanupService = new TrashCleanupService(
          connection,
          attachmentQueue as never,
        );
        await timeoutCleanupService.cleanupOldTrash();
      });

      const corruptPages = await db
        .selectFrom('pages')
        .select(['id', 'parentPageId', 'deletedAt'])
        .where('id', 'in', [self.id, corruptSideChild.id])
        .orderBy('id')
        .execute();
      const healthyPages = await db
        .selectFrom('pages')
        .select('id')
        .where('id', 'in', [healthyRoot.id, healthyChild.id])
        .execute();

      expect(corruptPages).toEqual(
        [
          { id: self.id, parentPageId: self.id, deletedAt: expiredAt },
          {
            id: corruptSideChild.id,
            parentPageId: self.id,
            deletedAt: expiredAt,
          },
        ].sort((left, right) => left.id.localeCompare(right.id)),
      );
      expect(healthyPages).toEqual([]);
      expect(attachmentQueue.add).toHaveBeenCalledTimes(2);
      const queuedPageIds = attachmentQueue.add.mock.calls.map(
        ([, payload]) => payload.pageId,
      );
      expect(queuedPageIds).toEqual(
        expect.arrayContaining([healthyRoot.id, healthyChild.id]),
      );
      expect(queuedPageIds).not.toEqual(
        expect.arrayContaining([self.id, corruptSideChild.id]),
      );
      expect(loggerError).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalledWith(
        `Failed to cleanup page ${self.id}: Cyclic page hierarchy detected`,
        expect.stringContaining(
          'PageHierarchyCycleError: Cyclic page hierarchy detected',
        ),
      );
      expect(loggerError.mock.invocationCallOrder[0]).toBeLessThan(
        attachmentQueue.add.mock.invocationCallOrder[0],
      );
    });
  });

  describe('PageService.getPageBreadCrumbs', () => {
    it('returns every acyclic breadcrumb exactly once in root-to-child order', async () => {
      const { root, child, grandchild } = await seedAcyclicPageChain();
      const pageService = createPageService(db);

      const breadcrumbs = await pageService.getPageBreadCrumbs(grandchild.id);

      expect(breadcrumbs.map(({ id, title }) => ({ id, title }))).toEqual([
        { id: root.id, title: 'Root' },
        { id: child.id, title: 'Child' },
        { id: grandchild.id, title: 'Grandchild' },
      ]);
      expect(breadcrumbs).toHaveLength(3);
      for (const breadcrumb of breadcrumbs) {
        expect(breadcrumb).not.toHaveProperty('isCycle');
        expect(breadcrumb).not.toHaveProperty('traversalPath');
      }
    });

    it('raises PageHierarchyCycleError for a self-cycle', async () => {
      const { self } = await seedSelfCycle();

      await withStatementTimeout(async (connection) => {
        const pageService = createPageService(connection);
        const breadcrumbs = pageService.getPageBreadCrumbs(self.id);

        await expect(breadcrumbs).rejects.toBeInstanceOf(
          PageHierarchyCycleError,
        );
        await expect(breadcrumbs).rejects.toEqual(
          expect.objectContaining({
            code: 'PAGE_HIERARCHY_CYCLE',
            rootPageId: self.id,
          }) satisfies Partial<PageHierarchyCycleError>,
        );
      });
    });

    it('raises PageHierarchyCycleError for a two-page cycle', async () => {
      const { a } = await seedTwoPageCycle();

      await withStatementTimeout(async (connection) => {
        const pageService = createPageService(connection);
        const breadcrumbs = pageService.getPageBreadCrumbs(a.id);

        await expect(breadcrumbs).rejects.toBeInstanceOf(
          PageHierarchyCycleError,
        );
        await expect(breadcrumbs).rejects.toEqual(
          expect.objectContaining({
            code: 'PAGE_HIERARCHY_CYCLE',
            rootPageId: a.id,
          }) satisfies Partial<PageHierarchyCycleError>,
        );
      });
    });
  });

  describe('ShareService.getShareForPage', () => {
    it('returns the nearest valid inherited share without a depth limit', async () => {
      const { root, grandchild } = await seedAcyclicPageChain();
      const context = await db
        .selectFrom('pages')
        .select(['spaceId', 'workspaceId'])
        .where('id', '=', root.id)
        .executeTakeFirstOrThrow();
      let descendantId = grandchild.id;
      let nearerSharedAncestorId: string;

      for (let depth = 3; depth <= 52; depth += 1) {
        const descendant = await db
          .insertInto('pages')
          .values({
            parentPageId: descendantId,
            slugId: randomUUID(),
            spaceId: context.spaceId,
            title: `Descendant ${depth}`,
            workspaceId: context.workspaceId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        descendantId = descendant.id;
        if (depth === 26) {
          nearerSharedAncestorId = descendant.id;
        }
      }

      const fartherShare = await insertShare(root.id, true);
      const nearerShare = await insertShare(nearerSharedAncestorId, true);
      const shareService = createShareService(db);

      const share = await shareService.getShareForPage(
        descendantId,
        context.workspaceId,
      );

      expect(share).toEqual(
        expect.objectContaining({
          id: nearerShare.id,
          pageId: nearerSharedAncestorId,
          level: 26,
        }),
      );
      expect(share.id).not.toBe(fartherShare.id);
    });

    it('returns a direct share without traversing corrupt parents', async () => {
      const { self } = await seedSelfCycle();
      const storedShare = await insertShare(self.id, false);

      await withStatementTimeout(async (connection) => {
        const shareService = createShareService(connection);

        await expect(
          shareService.getShareForPage(self.id, storedShare.workspaceId),
        ).resolves.toEqual(
          expect.objectContaining({
            id: storedShare.id,
            pageId: self.id,
            level: 0,
          }),
        );
      });
    });

    it('rejects a share from a different workspace', async () => {
      const { root } = await seedAcyclicPageChain();
      await insertShare(root.id, true);
      const shareService = createShareService(db);

      await expect(
        shareService.getShareForPage(root.id, randomUUID()),
      ).resolves.toBeUndefined();
    });

    it('rejects an inherited share that excludes subpages', async () => {
      const { root, grandchild } = await seedAcyclicPageChain();
      const storedShare = await insertShare(root.id, false);
      const shareService = createShareService(db);

      await expect(
        shareService.getShareForPage(grandchild.id, storedShare.workspaceId),
      ).resolves.toBeUndefined();
    });

    it('returns undefined for a cyclic chain with no reachable share', async () => {
      const { a } = await seedTwoPageCycle();
      const { workspaceId } = await db
        .selectFrom('pages')
        .select('workspaceId')
        .where('id', '=', a.id)
        .executeTakeFirstOrThrow();

      await withStatementTimeout(async (connection) => {
        const shareService = createShareService(connection);

        await expect(
          shareService.getShareForPage(a.id, workspaceId),
        ).resolves.toBeUndefined();
      });
    });
  });

  describe('single-page permissions', () => {
    it('preserves unrestricted acyclic access', async () => {
      const { grandchild } = await seedAcyclicPageChain();
      const userId = await insertTestUser(grandchild.id);
      const repo = createPagePermissionRepo(db);

      await expect(
        repo.canUserEditPage(userId, grandchild.id),
      ).resolves.toEqual({
        hasAnyRestriction: false,
        canAccess: true,
        canEdit: true,
      });
      await expect(
        repo.getUserPageAccessLevel(userId, grandchild.id),
      ).resolves.toEqual({
        hasDirectRestriction: false,
        hasInheritedRestriction: false,
        hasAnyRestriction: false,
        canAccess: true,
        canEdit: true,
      });
      await expect(repo.hasRestrictedAncestor(grandchild.id)).resolves.toBe(
        false,
      );
      await expect(
        repo.getUserIdsWithPageAccess(grandchild.id, [userId]),
      ).resolves.toEqual([userId]);
      await expect(
        repo.findRestrictedAncestor(grandchild.id),
      ).resolves.toBeUndefined();
    });

    it('preserves permitted acyclic access', async () => {
      const { root, grandchild } = await seedAcyclicPageChain();
      const userId = await insertTestUser(grandchild.id);
      const restriction = await restrictPage(root.id, userId);
      const repo = createPagePermissionRepo(db);

      await expect(
        repo.canUserEditPage(userId, grandchild.id),
      ).resolves.toEqual({
        hasAnyRestriction: true,
        canAccess: true,
        canEdit: true,
      });
      await expect(
        repo.getUserPageAccessLevel(userId, grandchild.id),
      ).resolves.toEqual({
        hasDirectRestriction: false,
        hasInheritedRestriction: true,
        hasAnyRestriction: true,
        canAccess: true,
        canEdit: true,
      });
      await expect(repo.hasRestrictedAncestor(grandchild.id)).resolves.toBe(
        true,
      );
      await expect(
        repo.getUserIdsWithPageAccess(grandchild.id, [userId]),
      ).resolves.toEqual([userId]);
      await expect(repo.findRestrictedAncestor(grandchild.id)).resolves.toEqual(
        { ...restriction, depth: 2 },
      );
    });

    it('preserves denied acyclic access', async () => {
      const { root, grandchild } = await seedAcyclicPageChain();
      const userId = await insertTestUser(grandchild.id);
      const restriction = await restrictPage(root.id);
      const repo = createPagePermissionRepo(db);

      await expect(
        repo.canUserEditPage(userId, grandchild.id),
      ).resolves.toEqual({
        hasAnyRestriction: true,
        canAccess: false,
        canEdit: false,
      });
      await expect(
        repo.getUserPageAccessLevel(userId, grandchild.id),
      ).resolves.toEqual({
        hasDirectRestriction: false,
        hasInheritedRestriction: true,
        hasAnyRestriction: true,
        canAccess: false,
        canEdit: false,
      });
      await expect(repo.hasRestrictedAncestor(grandchild.id)).resolves.toBe(
        true,
      );
      await expect(
        repo.getUserIdsWithPageAccess(grandchild.id, [userId]),
      ).resolves.toEqual([]);
      await expect(repo.findRestrictedAncestor(grandchild.id)).resolves.toEqual(
        { ...restriction, depth: 2 },
      );
    });

    describe.each([
      ['a self-cycle', async () => (await seedSelfCycle()).self.id],
      ['a two-page cycle', async () => (await seedTwoPageCycle()).a.id],
    ])('%s', (_cycleName, seedCycle) => {
      it('fails canUserEditPage closed', async () => {
        const pageId = await seedCycle();
        const userId = await insertTestUser(pageId);

        await withStatementTimeout(async (connection) => {
          const repo = createPagePermissionRepo(connection);

          await expect(repo.canUserEditPage(userId, pageId)).resolves.toEqual({
            hasAnyRestriction: true,
            canAccess: false,
            canEdit: false,
          });
        });
      });

      it('fails getUserPageAccessLevel closed', async () => {
        const pageId = await seedCycle();
        const userId = await insertTestUser(pageId);

        await withStatementTimeout(async (connection) => {
          const repo = createPagePermissionRepo(connection);

          await expect(
            repo.getUserPageAccessLevel(userId, pageId),
          ).resolves.toEqual(
            expect.objectContaining({
              hasAnyRestriction: true,
              canAccess: false,
              canEdit: false,
            }),
          );
        });
      });

      it('treats a cycle as a restricted ancestor', async () => {
        const pageId = await seedCycle();

        await withStatementTimeout(async (connection) => {
          const repo = createPagePermissionRepo(connection);

          await expect(repo.hasRestrictedAncestor(pageId)).resolves.toBe(true);
        });
      });

      it('filters every candidate user from a cycle', async () => {
        const pageId = await seedCycle();
        const userId = await insertTestUser(pageId);

        await withStatementTimeout(async (connection) => {
          const repo = createPagePermissionRepo(connection);

          await expect(
            repo.getUserIdsWithPageAccess(pageId, [userId]),
          ).resolves.toEqual([]);
        });
      });

      it('raises PageHierarchyCycleError from findRestrictedAncestor', async () => {
        const pageId = await seedCycle();

        await withStatementTimeout(async (connection) => {
          const repo = createPagePermissionRepo(connection);
          const restrictedAncestor = repo.findRestrictedAncestor(pageId);

          await expect(restrictedAncestor).rejects.toBeInstanceOf(
            PageHierarchyCycleError,
          );
          await expect(restrictedAncestor).rejects.toEqual(
            expect.objectContaining({
              code: 'PAGE_HIERARCHY_CYCLE',
              rootPageId: pageId,
            }) satisfies Partial<PageHierarchyCycleError>,
          );
        });
      });
    });
  });

  describe('bulk permissions', () => {
    it('excludes a cyclic page from the unrestricted-space fast path', async () => {
      const { grandchild } = await seedAcyclicPageChain();
      const { cyclePageId, spaceId } = await insertTwoPageCycleInPageSpace(
        grandchild.id,
      );
      const userId = await insertTestUser(grandchild.id);

      await withStatementTimeout(async (connection) => {
        const repo = createPagePermissionRepo(connection);

        await expect(repo.hasRestrictedPagesInSpace(spaceId)).resolves.toBe(
          false,
        );
        await expect(
          repo.filterAccessiblePageIds({
            pageIds: [grandchild.id, cyclePageId],
            userId,
            spaceId,
          }),
        ).resolves.toEqual([grandchild.id]);
      });
    });

    it('keeps an accessible acyclic page while excluding a cyclic page', async () => {
      const { grandchild } = await seedAcyclicPageChain();
      const { a } = await seedTwoPageCycle();
      const userId = await insertTestUser(grandchild.id);

      await withStatementTimeout(async (connection) => {
        const repo = createPagePermissionRepo(connection);

        await expect(
          repo.filterAccessiblePageIds({
            pageIds: [grandchild.id, a.id],
            userId,
          }),
        ).resolves.toEqual([grandchild.id]);
      });
    });

    it('keeps acyclic permission details while excluding a cyclic page', async () => {
      const { grandchild } = await seedAcyclicPageChain();
      const { a } = await seedTwoPageCycle();
      const userId = await insertTestUser(grandchild.id);

      await withStatementTimeout(async (connection) => {
        const repo = createPagePermissionRepo(connection);

        await expect(
          repo.filterAccessiblePageIdsWithPermissions(
            [grandchild.id, a.id],
            userId,
          ),
        ).resolves.toEqual([{ id: grandchild.id, canEdit: true }]);
      });
    });

    it('keeps a parent with an accessible child while excluding a cyclic child', async () => {
      const { root, child } = await seedAcyclicPageChain();
      const { a } = await seedTwoPageCycle();
      const userId = await insertTestUser(child.id);

      await withStatementTimeout(async (connection) => {
        const repo = createPagePermissionRepo(connection);

        await expect(
          repo.getParentIdsWithAccessibleChildren([root.id, a.id], userId),
        ).resolves.toEqual([root.id]);
      });
    });

    it('keeps independent acyclic seeds that share ancestors accessible', async () => {
      const { firstChild, secondChild, grandchild } =
        await seedBranchingDescendantTree();
      const userId = await insertTestUser(grandchild.id);
      const pageIds = [firstChild.id, secondChild.id, grandchild.id];
      const expectedPageIds = [...pageIds].sort();

      await withStatementTimeout(async (connection) => {
        const repo = createPagePermissionRepo(connection);

        const accessiblePageIds = await repo.filterAccessiblePageIds({
          pageIds,
          userId,
        });
        const permissionDetails =
          await repo.filterAccessiblePageIdsWithPermissions(pageIds, userId);

        expect(accessiblePageIds.sort()).toEqual(expectedPageIds);
        expect(
          permissionDetails
            .map(({ id, canEdit }) => ({ id, canEdit }))
            .sort((left, right) => left.id.localeCompare(right.id)),
        ).toEqual(
          expectedPageIds.map((id) => ({
            id,
            canEdit: true,
          })),
        );
      });
    });
  });
});
