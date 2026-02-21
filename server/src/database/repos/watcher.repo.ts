import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { watchers } from '../schema/notifications';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type WatcherInsert = typeof watchers.$inferInsert;

export class WatcherRepo {
  constructor(private db: DB) {}

  async findByUserAndPage(userId: string, pageId: string) {
    return this.db.query.watchers.findFirst({
      where: and(
        eq(watchers.userId, userId),
        eq(watchers.pageId, pageId),
      ),
    });
  }

  async findPageWatchers(pageId: string) {
    return this.db.query.watchers.findMany({
      where: and(
        eq(watchers.pageId, pageId),
        isNull(watchers.mutedAt),
      ),
    });
  }

  async getPageWatcherIds(pageId: string): Promise<string[]> {
    const result = await this.db
      .select({ userId: watchers.userId })
      .from(watchers)
      .where(and(eq(watchers.pageId, pageId), isNull(watchers.mutedAt)));
    return result.map(r => r.userId);
  }

  async insert(data: WatcherInsert) {
    const [result] = await this.db.insert(watchers).values(data).returning();
    return result;
  }

  async insertMany(data: WatcherInsert[]) {
    if (data.length === 0) return;
    await this.db.insert(watchers).values(data).onConflictDoNothing();
  }

  async upsert(data: WatcherInsert) {
    const existing = await this.findByUserAndPage(data.userId, data.pageId!);
    if (existing) {
      // Unmute if muted
      if (existing.mutedAt) {
        await this.db
          .update(watchers)
          .set({ mutedAt: null })
          .where(eq(watchers.id, existing.id));
      }
      return existing;
    }
    return this.insert(data);
  }

  async mute(userId: string, pageId: string) {
    await this.db
      .update(watchers)
      .set({ mutedAt: new Date().toISOString() })
      .where(and(eq(watchers.userId, userId), eq(watchers.pageId, pageId)));
  }

  async isWatching(userId: string, pageId: string): Promise<boolean> {
    const result = await this.db.query.watchers.findFirst({
      where: and(
        eq(watchers.userId, userId),
        eq(watchers.pageId, pageId),
        isNull(watchers.mutedAt),
      ),
    });
    return !!result;
  }

  async countPageWatchers(pageId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(watchers)
      .where(and(eq(watchers.pageId, pageId), isNull(watchers.mutedAt)));
    return result[0]?.count ?? 0;
  }

  async deleteByUserAndWorkspace(userId: string, workspaceId: string) {
    await this.db
      .delete(watchers)
      .where(and(eq(watchers.userId, userId), eq(watchers.workspaceId, workspaceId)));
  }

  async deleteByPageIds(pageIds: string[]) {
    if (pageIds.length === 0) return;
    await this.db.delete(watchers).where(inArray(watchers.pageId, pageIds));
  }
}
