import { eq, sql, and, isNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { workspaces, workspaceInvitations } from '../schema/workspaces';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type WorkspaceInsert = typeof workspaces.$inferInsert;
type WorkspaceUpdate = Partial<Omit<WorkspaceInsert, 'id' | 'createdAt'>>;

export class WorkspaceRepo {
  constructor(private db: DB) {}

  async findById(workspaceId: string) {
    return this.db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });
  }

  async findFirst() {
    return this.db.query.workspaces.findFirst({
      orderBy: (ws, { asc }) => [asc(ws.createdAt)],
    });
  }

  async findByHostname(hostname: string) {
    return this.db.query.workspaces.findFirst({
      where: (ws, { or }) => or(
        eq(ws.hostname, hostname),
        eq(ws.customDomain, hostname),
      ),
    });
  }

  async hostnameExists(hostname: string): Promise<boolean> {
    const result = await this.db.query.workspaces.findFirst({
      where: eq(workspaces.hostname, hostname),
    });
    return !!result;
  }

  async insertWorkspace(data: WorkspaceInsert) {
    const [result] = await this.db.insert(workspaces).values(data).returning();
    return result;
  }

  async updateWorkspace(updates: WorkspaceUpdate, workspaceId: string) {
    const [result] = await this.db
      .update(workspaces)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(workspaces.id, workspaceId))
      .returning();
    return result;
  }

  async count(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workspaces);
    return result[0]?.count ?? 0;
  }

  async getActiveUserCount(workspaceId: string): Promise<number> {
    const { users } = await import('../schema/users');
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, workspaceId),
          isNull(users.deletedAt),
          isNull(users.deactivatedAt),
        )
      );
    return result[0]?.count ?? 0;
  }

  // Invitation methods
  async findInvitationByToken(token: string) {
    return this.db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.token, token),
    });
  }

  async findInvitationByEmail(email: string, workspaceId: string) {
    return this.db.query.workspaceInvitations.findFirst({
      where: and(
        eq(workspaceInvitations.email, email),
        eq(workspaceInvitations.workspaceId, workspaceId),
      ),
    });
  }

  async insertInvitation(data: typeof workspaceInvitations.$inferInsert) {
    const [result] = await this.db.insert(workspaceInvitations).values(data).returning();
    return result;
  }

  async deleteInvitation(invitationId: string) {
    await this.db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitationId));
  }

  async getPendingInvitations(workspaceId: string) {
    return this.db.query.workspaceInvitations.findMany({
      where: eq(workspaceInvitations.workspaceId, workspaceId),
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    });
  }
}
