import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { spaces } from './spaces';
import { pages } from './pages';
import { users } from './users';

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  fileExt: text('file_ext').notNull(),
  mimeType: text('mime_type'),
  type: text('type'),
  textContent: text('text_content'),
  creatorId: text('creator_id').notNull().references(() => users.id),
  pageId: text('page_id').references(() => pages.id),
  spaceId: text('space_id').references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('attachments_page_idx').on(table.pageId),
  index('attachments_space_idx').on(table.spaceId),
  index('attachments_workspace_idx').on(table.workspaceId),
  index('attachments_creator_idx').on(table.creatorId),
]);

export const fileTasks = sqliteTable('file_tasks', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  type: text('type'),
  status: text('status').default('pending'),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileExt: text('file_ext'),
  fileSize: integer('file_size'),
  source: text('source'),
  errorMessage: text('error_message'),
  creatorId: text('creator_id').references(() => users.id),
  spaceId: text('space_id').references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('file_tasks_workspace_idx').on(table.workspaceId),
  index('file_tasks_status_idx').on(table.status),
  index('file_tasks_creator_idx').on(table.creatorId),
]);
