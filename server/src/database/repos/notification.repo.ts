import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { notifications } from '../schema/notifications';
import type * as schema from '../schema';
import type { PaginationOptions } from './user.repo';

type DB = BunSQLiteDatabase<typeof schema>;
type NotificationInsert = typeof notifications.$inferInsert;

export class NotificationRepo {
  constructor(private db: DB) {}

  async findById(notificationId: string) {
    return this.db.query.notifications.findFirst({
      where: eq(notifications.id, notificationId),
    });
  }

  async findByUserId(userId: string, options: PaginationOptions = {}) {
    const { limit = 20, offset = 0 } = options;
    const conditions = [
      eq(notifications.userId, userId),
      isNull(notifications.archivedAt),
    ];

    const [items, countResult, unreadCount] = await Promise.all([
      this.db.query.notifications.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (n, { desc }) => [desc(n.createdAt)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(...conditions)),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), isNull(notifications.archivedAt))),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
      unreadCount: unreadCount[0]?.count ?? 0,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          isNull(notifications.archivedAt),
        )
      );
    return result[0]?.count ?? 0;
  }

  async insert(data: NotificationInsert) {
    const [result] = await this.db.insert(notifications).values(data).returning();
    return result;
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markMultipleAsRead(notificationIds: string[], userId: string) {
    if (notificationIds.length === 0) return;
    await this.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          inArray(notifications.id, notificationIds),
          eq(notifications.userId, userId),
        )
      );
  }

  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        )
      );
  }

  async markAsEmailed(notificationId: string) {
    await this.db
      .update(notifications)
      .set({ emailedAt: new Date().toISOString() })
      .where(eq(notifications.id, notificationId));
  }
}
