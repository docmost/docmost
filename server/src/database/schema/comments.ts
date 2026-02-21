import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { spaces } from './spaces';
import { pages } from './pages';
import { users } from './users';

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  content: text('content', { mode: 'json' }),
  selection: text('selection'),
  type: text('type'),
  pageId: text('page_id').notNull().references(() => pages.id),
  parentCommentId: text('parent_comment_id').references((): AnySQLiteColumn => comments.id),
  creatorId: text('creator_id').references(() => users.id),
  lastEditedById: text('last_edited_by_id').references(() => users.id),
  editedAt: text('edited_at'),
  resolvedAt: text('resolved_at'),
  resolvedById: text('resolved_by_id').references(() => users.id),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('comments_page_idx').on(table.pageId),
  index('comments_workspace_idx').on(table.workspaceId),
  index('comments_creator_idx').on(table.creatorId),
  index('comments_parent_idx').on(table.parentCommentId),
]);
