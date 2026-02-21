import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { spaces } from './spaces';
import { pages } from './pages';
import { users } from './users';

export const shares = sqliteTable('shares', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  key: text('key').notNull(),
  pageId: text('page_id').references(() => pages.id),
  includeSubPages: integer('include_sub_pages', { mode: 'boolean' }),
  searchIndexing: integer('search_indexing', { mode: 'boolean' }),
  creatorId: text('creator_id').references(() => users.id),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  uniqueIndex('shares_key_idx').on(table.key),
  index('shares_page_idx').on(table.pageId),
  index('shares_workspace_idx').on(table.workspaceId),
]);
