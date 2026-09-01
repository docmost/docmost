import { randomUUID } from 'node:crypto';
import { PageService } from '../src/core/page/services/page.service';
import { ShareService } from '../src/core/share/share.service';
import { PageHierarchyCycleError } from '../src/database/helpers/page-hierarchy-cycle';
import { KyselyDB } from '../src/database/types/kysely.types';
import { db, withStatementTimeout } from './support/database';
import {
  seedAcyclicPageChain,
  seedSelfCycle,
  seedTwoPageCycle,
} from './support/page-hierarchy-fixtures';

function createPageService(connection: KyselyDB): PageService {
  return new PageService(
    undefined as never,
    undefined as never,
    undefined as never,
    connection,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
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

describe('cycle-safe page hierarchy reads', () => {
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

        await expect(pageService.getPageBreadCrumbs(self.id)).rejects.toEqual(
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

        await expect(pageService.getPageBreadCrumbs(a.id)).rejects.toEqual(
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

      for (let depth = 3; depth <= 26; depth += 1) {
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
      }

      const storedShare = await insertShare(root.id, true);
      const shareService = createShareService(db);

      const share = await shareService.getShareForPage(
        descendantId,
        context.workspaceId,
      );

      expect(share).toEqual(
        expect.objectContaining({
          id: storedShare.id,
          pageId: root.id,
          level: 26,
        }),
      );
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
});
