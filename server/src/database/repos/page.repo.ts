import { eq, and, isNull, isNotNull, sql, like, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { pages, pageHistory, backlinks } from '../schema/pages';
import type * as schema from '../schema';
import type { PaginationOptions } from './user.repo';

type DB = BunSQLiteDatabase<typeof schema>;
type PageInsert = typeof pages.$inferInsert;
type PageUpdate = Partial<Omit<PageInsert, 'id' | 'createdAt'>>;
type PageHistoryInsert = typeof pageHistory.$inferInsert;

export class PageRepo {
  constructor(private db: DB) {}

  async findById(pageId: string, opts: { includeContent?: boolean; includeYdoc?: boolean } = {}) {
    return this.db.query.pages.findFirst({
      where: or(
        eq(pages.id, pageId),
        eq(pages.slugId, pageId),
      ),
      columns: opts.includeYdoc
        ? undefined
        : { ydoc: false },
    });
  }

  async findBySlugId(slugId: string) {
    return this.db.query.pages.findFirst({
      where: eq(pages.slugId, slugId),
    });
  }

  async insertPage(data: PageInsert) {
    const [result] = await this.db.insert(pages).values(data).returning();
    return result;
  }

  async updatePage(updates: PageUpdate, pageId: string) {
    const [result] = await this.db
      .update(pages)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(pages.id, pageId))
      .returning();
    return result;
  }

  async updatePages(updates: PageUpdate, pageIds: string[]) {
    if (pageIds.length === 0) return;
    await this.db
      .update(pages)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(inArray(pages.id, pageIds));
  }

  async deletePage(pageId: string) {
    await this.db.delete(pages).where(eq(pages.id, pageId));
  }

  async softDeletePage(pageId: string, deletedById: string) {
    const now = new Date().toISOString();
    await this.db
      .update(pages)
      .set({ deletedAt: now, deletedById, updatedAt: now })
      .where(eq(pages.id, pageId));
  }

  async restorePage(pageId: string) {
    await this.db
      .update(pages)
      .set({ deletedAt: null, deletedById: null, updatedAt: new Date().toISOString() })
      .where(eq(pages.id, pageId));
  }

  async getChildPages(parentPageId: string) {
    return this.db.query.pages.findMany({
      where: and(
        eq(pages.parentPageId, parentPageId),
        isNull(pages.deletedAt),
      ),
      orderBy: (p, { asc }) => [asc(p.position), asc(p.createdAt)],
    });
  }

  async getRecentPagesInSpace(spaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0 } = options;
    return this.db.query.pages.findMany({
      where: and(
        eq(pages.spaceId, spaceId),
        isNull(pages.deletedAt),
      ),
      limit,
      offset,
      orderBy: (p, { desc }) => [desc(p.updatedAt)],
      columns: { ydoc: false, content: false, textContent: false },
    });
  }

  async getDeletedPagesInSpace(spaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0 } = options;
    return this.db.query.pages.findMany({
      where: and(
        eq(pages.spaceId, spaceId),
        isNotNull(pages.deletedAt),
      ),
      limit,
      offset,
      orderBy: (p, { desc }) => [desc(p.deletedAt)],
      columns: { ydoc: false, content: false, textContent: false },
    });
  }

  // Get a page and all its descendants (recursive)
  async getPageAndDescendants(parentPageId: string): Promise<(typeof pages.$inferSelect)[]> {
    // Use recursive CTE to get all descendants
    const result = await this.db.run(sql`
      WITH RECURSIVE descendants AS (
        SELECT id, parent_page_id, slug_id, title, icon, space_id, workspace_id, deleted_at, created_at, updated_at, position, is_locked, creator_id, last_updated_by_id, deleted_by_id, contributor_ids, cover_photo
        FROM pages
        WHERE id = ${parentPageId}
        UNION ALL
        SELECT p.id, p.parent_page_id, p.slug_id, p.title, p.icon, p.space_id, p.workspace_id, p.deleted_at, p.created_at, p.updated_at, p.position, p.is_locked, p.creator_id, p.last_updated_by_id, p.deleted_by_id, p.contributor_ids, p.cover_photo
        FROM pages p
        INNER JOIN descendants d ON p.parent_page_id = d.id
      )
      SELECT * FROM descendants
    `);
    return result.rows as unknown as (typeof pages.$inferSelect)[];
  }

  async getRootPagesInSpace(spaceId: string) {
    return this.db.query.pages.findMany({
      where: and(
        eq(pages.spaceId, spaceId),
        isNull(pages.parentPageId),
        isNull(pages.deletedAt),
      ),
      orderBy: (p, { asc }) => [asc(p.position), asc(p.createdAt)],
      columns: { ydoc: false, content: false, textContent: false },
    });
  }
}

function or(...conditions: Parameters<typeof and>) {
  return sql`(${conditions.map(c => sql`${c}`).reduce((a, b) => sql`${a} OR ${b}`)})`;
}

export class PageHistoryRepo {
  constructor(private db: DB) {}

  async findById(historyId: string, opts: { includeContent?: boolean } = {}) {
    return this.db.query.pageHistory.findFirst({
      where: eq(pageHistory.id, historyId),
    });
  }

  async insertPageHistory(data: PageHistoryInsert) {
    const [result] = await this.db.insert(pageHistory).values(data).returning();
    return result;
  }

  async saveHistory(page: typeof pages.$inferSelect) {
    return this.insertPageHistory({
      pageId: page.id,
      title: page.title,
      icon: page.icon,
      coverPhoto: page.coverPhoto,
      content: page.content,
      textContent: page.textContent,
      slugId: page.slugId,
      lastUpdatedById: page.lastUpdatedById,
      contributorIds: page.contributorIds,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    });
  }

  async findPageHistoryByPageId(pageId: string, options: PaginationOptions = {}) {
    const { limit = 20, offset = 0 } = options;
    const [items, countResult] = await Promise.all([
      this.db.query.pageHistory.findMany({
        where: eq(pageHistory.pageId, pageId),
        limit,
        offset,
        orderBy: (ph, { desc }) => [desc(ph.createdAt)],
        columns: { ydoc: false, content: false, textContent: false },
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(pageHistory)
        .where(eq(pageHistory.pageId, pageId)),
    ]);
    return { items, total: countResult[0]?.count ?? 0 };
  }

  async findPageLastHistory(pageId: string) {
    return this.db.query.pageHistory.findFirst({
      where: eq(pageHistory.pageId, pageId),
      orderBy: (ph, { desc }) => [desc(ph.createdAt)],
    });
  }
}

export class BacklinkRepo {
  constructor(private db: DB) {}

  async findById(backlinkId: string) {
    return this.db.query.backlinks.findFirst({
      where: eq(backlinks.id, backlinkId),
    });
  }

  async insertBacklink(data: typeof backlinks.$inferInsert) {
    // Ignore duplicates
    const existing = await this.db.query.backlinks.findFirst({
      where: and(
        eq(backlinks.sourcePageId, data.sourcePageId),
        eq(backlinks.targetPageId, data.targetPageId),
      ),
    });
    if (existing) return existing;
    const [result] = await this.db.insert(backlinks).values(data).returning();
    return result;
  }

  async deleteBacklink(backlinkId: string) {
    await this.db.delete(backlinks).where(eq(backlinks.id, backlinkId));
  }

  async deleteBacklinksBySourcePage(sourcePageId: string) {
    await this.db.delete(backlinks).where(eq(backlinks.sourcePageId, sourcePageId));
  }

  async getBacklinksToPage(targetPageId: string) {
    return this.db.query.backlinks.findMany({
      where: eq(backlinks.targetPageId, targetPageId),
    });
  }
}
