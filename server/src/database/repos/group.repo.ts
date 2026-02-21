import { eq, and, isNull, sql, like } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { groups, groupUsers } from '../schema/groups';
import type * as schema from '../schema';
import type { PaginationOptions } from './user.repo';

type DB = BunSQLiteDatabase<typeof schema>;
type GroupInsert = typeof groups.$inferInsert;
type GroupUpdate = Partial<Omit<GroupInsert, 'id' | 'createdAt'>>;

export class GroupRepo {
  constructor(private db: DB) {}

  async findById(groupId: string, workspaceId: string) {
    return this.db.query.groups.findFirst({
      where: and(
        eq(groups.id, groupId),
        eq(groups.workspaceId, workspaceId),
        isNull(groups.deletedAt),
      ),
    });
  }

  async findByName(name: string, workspaceId: string) {
    return this.db.query.groups.findFirst({
      where: and(
        sql`lower(${groups.name}) = lower(${name})`,
        eq(groups.workspaceId, workspaceId),
        isNull(groups.deletedAt),
      ),
    });
  }

  async insertGroup(data: GroupInsert) {
    const [result] = await this.db.insert(groups).values(data).returning();
    return result;
  }

  async updateGroup(updates: GroupUpdate, groupId: string, workspaceId: string) {
    const [result] = await this.db
      .update(groups)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(and(eq(groups.id, groupId), eq(groups.workspaceId, workspaceId)))
      .returning();
    return result;
  }

  async deleteGroup(groupId: string, workspaceId: string) {
    await this.db
      .update(groups)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(groups.id, groupId), eq(groups.workspaceId, workspaceId)));
  }

  async getDefaultGroup(workspaceId: string) {
    return this.db.query.groups.findFirst({
      where: and(
        eq(groups.workspaceId, workspaceId),
        eq(groups.isDefault, true),
        isNull(groups.deletedAt),
      ),
    });
  }

  async createDefaultGroup(workspaceId: string, creatorId?: string) {
    const [result] = await this.db.insert(groups).values({
      name: 'Everyone',
      isDefault: true,
      workspaceId,
      creatorId: creatorId ?? null,
    }).returning();
    return result;
  }

  async getGroupsPaginated(workspaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0, query } = options;
    const conditions = [
      eq(groups.workspaceId, workspaceId),
      isNull(groups.deletedAt),
    ];

    if (query) {
      conditions.push(like(groups.name, `%${query}%`));
    }

    const [items, countResult] = await Promise.all([
      this.db.query.groups.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (g, { asc }) => [asc(g.name)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(groups)
        .where(and(...conditions)),
    ]);

    return { items, total: countResult[0]?.count ?? 0 };
  }
}

export class GroupUserRepo {
  constructor(private db: DB) {}

  async findGroupUser(userId: string, groupId: string) {
    return this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.userId, userId),
        eq(groupUsers.groupId, groupId),
      ),
    });
  }

  async insertGroupUser(data: typeof groupUsers.$inferInsert) {
    const [result] = await this.db.insert(groupUsers).values(data).returning();
    return result;
  }

  async addUserToGroup(userId: string, groupId: string) {
    const existing = await this.findGroupUser(userId, groupId);
    if (existing) return existing;
    return this.insertGroupUser({ userId, groupId });
  }

  async removeUserFromGroup(userId: string, groupId: string) {
    await this.db
      .delete(groupUsers)
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.groupId, groupId)));
  }

  async getUserIdsByGroupId(groupId: string): Promise<string[]> {
    const result = await this.db
      .select({ userId: groupUsers.userId })
      .from(groupUsers)
      .where(eq(groupUsers.groupId, groupId));
    return result.map(r => r.userId);
  }

  async getGroupUsersPaginated(groupId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0 } = options;
    const { users } = await import('../schema/users');

    const items = await this.db
      .select({
        id: groupUsers.id,
        userId: groupUsers.userId,
        groupId: groupUsers.groupId,
        createdAt: groupUsers.createdAt,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(groupUsers)
      .leftJoin(users, eq(groupUsers.userId, users.id))
      .where(eq(groupUsers.groupId, groupId))
      .limit(limit)
      .offset(offset)
      .orderBy(users.name);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(groupUsers)
      .where(eq(groupUsers.groupId, groupId));

    return { items, total: countResult[0]?.count ?? 0 };
  }
}
