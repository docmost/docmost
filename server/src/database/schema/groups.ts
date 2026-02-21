import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { users } from './users';

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  creatorId: text('creator_id').references(() => users.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('groups_workspace_idx').on(table.workspaceId),
  index('groups_name_workspace_idx').on(table.name, table.workspaceId),
]);

export const groupUsers = sqliteTable('group_users', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  groupId: text('group_id').notNull().references(() => groups.id),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('group_users_group_idx').on(table.groupId),
  index('group_users_user_idx').on(table.userId),
]);
