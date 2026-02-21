import { eq, and, isNull, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { shares } from '../schema/shares';
import type * as schema from '../schema';
import type { PaginationOptions } from './user.repo';

type DB = BunSQLiteDatabase<typeof schema>;
type ShareInsert = typeof shares.$inferInsert;
type ShareUpdate = Partial<Omit<ShareInsert, 'id' | 'createdAt'>>;

export class ShareRepo {
  constructor(private db: DB) {}

  async findById(shareId: string) {
    return this.db.query.shares.findFirst({
      where: and(
        eq(shares.id, shareId),
        isNull(shares.deletedAt),
      ),
    });
  }

  async findByKey(key: string) {
    return this.db.query.shares.findFirst({
      where: and(
        sql`lower(${shares.key}) = lower(${key})`,
        isNull(shares.deletedAt),
      ),
    });
  }

  async findByPageId(pageId: string) {
    return this.db.query.shares.findFirst({
      where: and(
        eq(shares.pageId, pageId),
        isNull(shares.deletedAt),
      ),
    });
  }

  async insertShare(data: ShareInsert) {
    const [result] = await this.db.insert(shares).values(data).returning();
    return result;
  }

  async updateShare(updates: ShareUpdate, shareId: string) {
    const [result] = await this.db
      .update(shares)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(shares.id, shareId))
      .returning();
    return result;
  }

  async deleteShare(shareId: string) {
    await this.db
      .update(shares)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(shares.id, shareId));
  }

  async deleteBySpaceId(spaceId: string) {
    await this.db
      .update(shares)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(shares.spaceId, spaceId));
  }

  async deleteByWorkspaceId(workspaceId: string) {
    await this.db
      .update(shares)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(shares.workspaceId, workspaceId));
  }

  async getShares(userId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0 } = options;
    const [items, countResult] = await Promise.all([
      this.db.query.shares.findMany({
        where: and(
          eq(shares.creatorId, userId),
          isNull(shares.deletedAt),
        ),
        limit,
        offset,
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(shares)
        .where(and(eq(shares.creatorId, userId), isNull(shares.deletedAt))),
    ]);
    return { items, total: countResult[0]?.count ?? 0 };
  }
}
