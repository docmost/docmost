import { sqliteTable, text, integer, blob, index } from 'drizzle-orm/sqlite-core';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { spaces } from './spaces';
import { users } from './users';

export const pages = sqliteTable('pages', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  slugId: text('slug_id').notNull(),
  title: text('title'),
  icon: text('icon'),
  coverPhoto: text('cover_photo'),
  content: text('content', { mode: 'json' }),
  ydoc: blob('ydoc'),
  textContent: text('text_content'),
  position: text('position'),
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
  parentPageId: text('parent_page_id').references((): AnySQLiteColumn => pages.id),
  creatorId: text('creator_id').references(() => users.id),
  lastUpdatedById: text('last_updated_by_id').references(() => users.id),
  deletedById: text('deleted_by_id').references(() => users.id),
  contributorIds: text('contributor_ids', { mode: 'json' }).$type<string[]>(),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('pages_space_idx').on(table.spaceId),
  index('pages_workspace_idx').on(table.workspaceId),
  index('pages_creator_idx').on(table.creatorId),
  index('pages_parent_idx').on(table.parentPageId),
  index('pages_slug_idx').on(table.slugId),
]);

export const pageHistory = sqliteTable('page_history', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  pageId: text('page_id').notNull().references(() => pages.id),
  title: text('title'),
  icon: text('icon'),
  coverPhoto: text('cover_photo'),
  content: text('content', { mode: 'json' }),
  textContent: text('text_content'),
  ydoc: blob('ydoc'),
  slug: text('slug'),
  slugId: text('slug_id'),
  version: integer('version'),
  lastUpdatedById: text('last_updated_by_id').references(() => users.id),
  contributorIds: text('contributor_ids', { mode: 'json' }).$type<string[]>(),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('page_history_page_idx').on(table.pageId),
  index('page_history_workspace_idx').on(table.workspaceId),
]);

export const backlinks = sqliteTable('backlinks', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  sourcePageId: text('source_page_id').notNull().references(() => pages.id),
  targetPageId: text('target_page_id').notNull().references(() => pages.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('backlinks_source_idx').on(table.sourcePageId),
  index('backlinks_target_idx').on(table.targetPageId),
  index('backlinks_workspace_idx').on(table.workspaceId),
]);
