import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { attachments } from '../schema/attachments';
import type * as schema from '../schema';

type DB = BunSQLiteDatabase<typeof schema>;
type AttachmentInsert = typeof attachments.$inferInsert;
type AttachmentUpdate = Partial<Omit<AttachmentInsert, 'id' | 'createdAt'>>;

export class AttachmentRepo {
  constructor(private db: DB) {}

  async findById(attachmentId: string) {
    return this.db.query.attachments.findFirst({
      where: eq(attachments.id, attachmentId),
    });
  }

  async findByFilePath(filePath: string) {
    return this.db.query.attachments.findFirst({
      where: eq(attachments.filePath, filePath),
    });
  }

  async insertAttachment(data: AttachmentInsert) {
    const [result] = await this.db.insert(attachments).values(data).returning();
    return result;
  }

  async findBySpaceId(spaceId: string) {
    return this.db.query.attachments.findMany({
      where: and(
        eq(attachments.spaceId, spaceId),
        isNull(attachments.deletedAt),
      ),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
  }

  async updateAttachment(updates: AttachmentUpdate, attachmentId: string) {
    const [result] = await this.db
      .update(attachments)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(attachments.id, attachmentId))
      .returning();
    return result;
  }

  async updateAttachmentsByPageId(updates: AttachmentUpdate, pageIds: string[]) {
    if (pageIds.length === 0) return;
    await this.db
      .update(attachments)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(inArray(attachments.pageId, pageIds));
  }

  async deleteAttachmentById(attachmentId: string) {
    await this.db
      .update(attachments)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(attachments.id, attachmentId));
  }

  async deleteAttachmentByFilePath(filePath: string) {
    await this.db
      .update(attachments)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(attachments.filePath, filePath));
  }
}
