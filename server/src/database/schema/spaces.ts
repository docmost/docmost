import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { users } from './users';
import { groups } from './groups';

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  name: text('name'),
  slug: text('slug').notNull(),
  description: text('description'),
  logo: text('logo'),
  visibility: text('visibility').notNull().default('private'),
  defaultRole: text('default_role').notNull().default('member'),
  settings: text('settings', { mode: 'json' }),
  creatorId: text('creator_id').references(() => users.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('spaces_workspace_idx').on(table.workspaceId),
  index('spaces_slug_workspace_idx').on(table.slug, table.workspaceId),
]);

export const spaceMembers = sqliteTable('space_members', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  userId: text('user_id').references(() => users.id),
  groupId: text('group_id').references(() => groups.id),
  role: text('role').notNull().default('member'),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  addedById: text('added_by_id').references(() => users.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('space_members_space_idx').on(table.spaceId),
  index('space_members_user_idx').on(table.userId),
  index('space_members_group_idx').on(table.groupId),
]);
