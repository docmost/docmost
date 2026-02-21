import { eq, and, isNull, sql, like, or } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { users, userTokens, userMfa } from '../schema/users';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type UserInsert = typeof users.$inferInsert;
type UserUpdate = Partial<Omit<UserInsert, 'id' | 'createdAt'>>;

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  query?: string;
}

export class UserRepo {
  constructor(private db: DB) {}

  async findById(userId: string, workspaceId: string) {
    return this.db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.workspaceId, workspaceId),
      ),
    });
  }

  async findByEmail(email: string, workspaceId: string) {
    return this.db.query.users.findFirst({
      where: and(
        sql`lower(${users.email}) = lower(${email})`,
        eq(users.workspaceId, workspaceId),
      ),
    });
  }

  async insertUser(data: UserInsert) {
    // Auto-generate name from email if not provided
    if (!data.name && data.email) {
      data.name = data.email.split('@')[0];
    }
    const [result] = await this.db.insert(users).values(data).returning();
    return result;
  }

  async updateUser(updates: UserUpdate, userId: string, workspaceId: string) {
    const [result] = await this.db
      .update(users)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(and(eq(users.id, userId), eq(users.workspaceId, workspaceId)))
      .returning();
    return result;
  }

  async updateLastLogin(userId: string, workspaceId: string) {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(and(eq(users.id, userId), eq(users.workspaceId, workspaceId)));
  }

  async roleCountByWorkspaceId(role: string, workspaceId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, workspaceId),
          eq(users.role, role),
          isNull(users.deletedAt),
        )
      );
    return result[0]?.count ?? 0;
  }

  async getUsersPaginated(workspaceId: string, options: PaginationOptions = {}) {
    const { limit = 50, offset = 0, query } = options;
    const conditions = [
      eq(users.workspaceId, workspaceId),
      isNull(users.deletedAt),
    ];

    if (query) {
      conditions.push(
        or(
          like(users.name, `%${query}%`),
          like(users.email, `%${query}%`),
        )!
      );
    }

    const [items, countResult] = await Promise.all([
      this.db.query.users.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(...conditions)),
    ]);

    return { items, total: countResult[0]?.count ?? 0 };
  }

  async softDeleteUser(userId: string, workspaceId: string) {
    await this.db
      .update(users)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(users.id, userId), eq(users.workspaceId, workspaceId)));
  }

  // User token methods
  async createToken(data: typeof userTokens.$inferInsert) {
    const [result] = await this.db.insert(userTokens).values(data).returning();
    return result;
  }

  async findTokenByValue(token: string) {
    return this.db.query.userTokens.findFirst({
      where: eq(userTokens.token, token),
    });
  }

  async markTokenUsed(tokenId: string) {
    await this.db
      .update(userTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(userTokens.id, tokenId));
  }

  async deleteToken(tokenId: string) {
    await this.db.delete(userTokens).where(eq(userTokens.id, tokenId));
  }

  // MFA methods
  async findMfaByUser(userId: string) {
    return this.db.query.userMfa.findFirst({
      where: eq(userMfa.userId, userId),
    });
  }

  async upsertMfa(data: typeof userMfa.$inferInsert) {
    const existing = await this.findMfaByUser(data.userId);
    if (existing) {
      const [result] = await this.db
        .update(userMfa)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(userMfa.userId, data.userId))
        .returning();
      return result;
    }
    const [result] = await this.db.insert(userMfa).values(data).returning();
    return result;
  }
}
