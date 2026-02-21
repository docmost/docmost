import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { spaces } from './spaces';
import { pages } from './pages';
import { users } from './users';
import { comments } from './comments';

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  actorId: text('actor_id').references(() => users.id),
  pageId: text('page_id').references(() => pages.id),
  spaceId: text('space_id').references(() => spaces.id),
  commentId: text('comment_id').references(() => comments.id),
  data: text('data', { mode: 'json' }),
  readAt: text('read_at'),
  emailedAt: text('emailed_at'),
  archivedAt: text('archived_at'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('notifications_user_idx').on(table.userId),
  index('notifications_workspace_idx').on(table.workspaceId),
  index('notifications_page_idx').on(table.pageId),
]);

export const watchers = sqliteTable('watchers', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  userId: text('user_id').notNull().references(() => users.id),
  pageId: text('page_id').references(() => pages.id),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  type: text('type').notNull(),
  addedById: text('added_by_id').references(() => users.id),
  mutedAt: text('muted_at'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('watchers_user_idx').on(table.userId),
  index('watchers_page_idx').on(table.pageId),
  index('watchers_space_idx').on(table.spaceId),
  index('watchers_workspace_idx').on(table.workspaceId),
]);
