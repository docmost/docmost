import { eq, and, isNull, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { comments } from '../schema/comments';
import type * as schema from '../schema';
import type { PaginationOptions } from './user.repo';

type DB = BunSQLiteDatabase<typeof schema>;
type CommentInsert = typeof comments.$inferInsert;
type CommentUpdate = Partial<Omit<CommentInsert, 'id' | 'createdAt'>>;

export class CommentRepo {
  constructor(private db: DB) {}

  async findById(commentId: string) {
    return this.db.query.comments.findFirst({
      where: eq(comments.id, commentId),
    });
  }

  async findPageComments(pageId: string, options: PaginationOptions = {}) {
    const { limit = 100, offset = 0 } = options;
    const [items, countResult] = await Promise.all([
      this.db.query.comments.findMany({
        where: and(
          eq(comments.pageId, pageId),
          isNull(comments.deletedAt),
        ),
        limit,
        offset,
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(comments)
        .where(and(eq(comments.pageId, pageId), isNull(comments.deletedAt))),
    ]);
    return { items, total: countResult[0]?.count ?? 0 };
  }

  async insertComment(data: CommentInsert) {
    const [result] = await this.db.insert(comments).values(data).returning();
    return result;
  }

  async updateComment(updates: CommentUpdate, commentId: string) {
    const [result] = await this.db
      .update(comments)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId))
      .returning();
    return result;
  }

  async deleteComment(commentId: string) {
    await this.db
      .update(comments)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId));
  }

  async hasChildren(commentId: string): Promise<boolean> {
    const result = await this.db.query.comments.findFirst({
      where: and(
        eq(comments.parentCommentId, commentId),
        isNull(comments.deletedAt),
      ),
    });
    return !!result;
  }

  async hasChildrenFromOtherUsers(commentId: string, userId: string): Promise<boolean> {
    const { ne } = await import('drizzle-orm');
    const result = await this.db.query.comments.findFirst({
      where: and(
        eq(comments.parentCommentId, commentId),
        ne(comments.creatorId, userId),
        isNull(comments.deletedAt),
      ),
    });
    return !!result;
  }
}
