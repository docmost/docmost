import { eq, and, isNull, sql, like, or, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { spaces, spaceMembers } from '../schema/spaces';
import { groupUsers } from '../schema/groups';
import type * as schema from '../schema';
import type { PaginationOptions } from './user.repo';

type DB = BunSQLiteDatabase<typeof schema>;
type SpaceInsert = typeof spaces.$inferInsert;
type SpaceUpdate = Partial<Omit<SpaceInsert, 'id' | 'createdAt'>>;
type SpaceMemberInsert = typeof spaceMembers.$inferInsert;
type SpaceMemberUpdate = Partial<Omit<SpaceMemberInsert, 'id' | 'createdAt'>>;

export class SpaceRepo {
  constructor(private db: DB) {}

  async findById(spaceId: string, workspaceId: string) {
    return this.db.query.spaces.findFirst({
      where: and(
        eq(spaces.id, spaceId),
        eq(spaces.workspaceId, workspaceId),
        isNull(spaces.deletedAt),
      ),
    });
  }

  async findBySlug(slug: string, workspaceId: string) {
    return this.db.query.spaces.findFirst({
      where: and(
        sql`lower(${spaces.slug}) = lower(${slug})`,
        eq(spaces.workspaceId, workspaceId),
        isNull(spaces.deletedAt),
      ),
    });
  }

  async slugExists(slug: string, workspaceId: string): Promise<boolean> {
    const result = await this.db.query.spaces.findFirst({
      where: and(
        sql`lower(${spaces.slug}) = lower(${slug})`,
        eq(spaces.workspaceId, workspaceId),
        isNull(spaces.deletedAt),
      ),
    });
    return !!result;
  }

  async insertSpace(data: SpaceInsert) {
    const [result] = await this.db.insert(spaces).values(data).returning();
    return result;
  }

  async updateSpace(updates: SpaceUpdate, spaceId: string, workspaceId: string) {
    const [result] = await this.db
      .update(spaces)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)))
      .returning();
    return result;
  }

  async deleteSpace(spaceId: string, workspaceId: string) {
    await this.db
      .update(spaces)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)));
  }

  async getSpacesInWorkspace(workspaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0, query } = options;
    const conditions = [
      eq(spaces.workspaceId, workspaceId),
      isNull(spaces.deletedAt),
    ];

    if (query) {
      conditions.push(like(spaces.name, `%${query}%`));
    }

    const [items, countResult] = await Promise.all([
      this.db.query.spaces.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (s, { asc }) => [asc(s.name)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(spaces)
        .where(and(...conditions)),
    ]);

    return { items, total: countResult[0]?.count ?? 0 };
  }
}

export class SpaceMemberRepo {
  constructor(private db: DB) {}

  async insertSpaceMember(data: SpaceMemberInsert) {
    const [result] = await this.db.insert(spaceMembers).values(data).returning();
    return result;
  }

  async updateSpaceMember(updates: SpaceMemberUpdate, memberId: string, spaceId: string) {
    const [result] = await this.db
      .update(spaceMembers)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(and(eq(spaceMembers.id, memberId), eq(spaceMembers.spaceId, spaceId)))
      .returning();
    return result;
  }

  async removeSpaceMemberById(memberId: string, spaceId: string) {
    await this.db
      .delete(spaceMembers)
      .where(and(eq(spaceMembers.id, memberId), eq(spaceMembers.spaceId, spaceId)));
  }

  async getSpaceMemberByUserId(spaceId: string, userId: string) {
    return this.db.query.spaceMembers.findFirst({
      where: and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        isNull(spaceMembers.deletedAt),
      ),
    });
  }

  async getSpaceMemberByGroupId(spaceId: string, groupId: string) {
    return this.db.query.spaceMembers.findFirst({
      where: and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.groupId, groupId),
        isNull(spaceMembers.deletedAt),
      ),
    });
  }

  async roleCountBySpaceId(role: string, spaceId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.role, role),
          isNull(spaceMembers.deletedAt),
        )
      );
    return result[0]?.count ?? 0;
  }

  async getSpaceMembersPaginated(spaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0 } = options;
    const conditions = [
      eq(spaceMembers.spaceId, spaceId),
      isNull(spaceMembers.deletedAt),
    ];

    const [items, countResult] = await Promise.all([
      this.db.query.spaceMembers.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (sm, { asc }) => [asc(sm.createdAt)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(spaceMembers)
        .where(and(...conditions)),
    ]);

    return { items, total: countResult[0]?.count ?? 0 };
  }

  // Get all roles for a user in a space (direct + via groups)
  async getUserSpaceRoles(userId: string, spaceId: string): Promise<string[]> {
    // Direct membership
    const directMember = await this.getSpaceMemberByUserId(spaceId, userId);
    const roles: string[] = [];
    if (directMember) roles.push(directMember.role);

    // Group membership
    const groupMemberships = await this.db
      .select({ role: spaceMembers.role })
      .from(spaceMembers)
      .innerJoin(groupUsers, eq(spaceMembers.groupId, groupUsers.groupId))
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(groupUsers.userId, userId),
          isNull(spaceMembers.deletedAt),
        )
      );

    roles.push(...groupMemberships.map(m => m.role));
    return [...new Set(roles)];
  }

  // Get all space IDs a user has access to (direct + via groups)
  async getUserSpaceIds(userId: string): Promise<string[]> {
    // Direct memberships
    const directSpaces = await this.db
      .select({ spaceId: spaceMembers.spaceId })
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.userId, userId),
          isNull(spaceMembers.deletedAt),
        )
      );

    // Group memberships
    const groupSpaces = await this.db
      .select({ spaceId: spaceMembers.spaceId })
      .from(spaceMembers)
      .innerJoin(groupUsers, eq(spaceMembers.groupId, groupUsers.groupId))
      .where(
        and(
          eq(groupUsers.userId, userId),
          isNull(spaceMembers.deletedAt),
        )
      );

    const spaceIds = new Set([
      ...directSpaces.map(s => s.spaceId),
      ...groupSpaces.map(s => s.spaceId),
    ]);

    return [...spaceIds];
  }

  async getUserSpaces(userId: string, workspaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0, query } = options;
    const spaceIds = await this.getUserSpaceIds(userId);
    if (spaceIds.length === 0) return { items: [], total: 0 };

    const conditions = [
      inArray(spaces.id, spaceIds),
      eq(spaces.workspaceId, workspaceId),
      isNull(spaces.deletedAt),
    ];

    if (query) {
      conditions.push(like(spaces.name, `%${query}%`));
    }

    const [items, countResult] = await Promise.all([
      this.db.query.spaces.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (s, { asc }) => [asc(s.name)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(spaces)
        .where(and(...conditions)),
    ]);

    return { items, total: countResult[0]?.count ?? 0 };
  }

  async getSpaceIdsByGroupId(groupId: string): Promise<string[]> {
    const result = await this.db
      .select({ spaceId: spaceMembers.spaceId })
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.groupId, groupId),
          isNull(spaceMembers.deletedAt),
        )
      );
    return result.map(r => r.spaceId);
  }
}
