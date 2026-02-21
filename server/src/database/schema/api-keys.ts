import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';
import { users } from './users';

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  name: text('name'),
  // The hashed key value — never stored in plaintext
  key: text('key').notNull(),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  creatorId: text('creator_id').notNull().references(() => users.id),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('api_keys_workspace_idx').on(table.workspaceId),
  index('api_keys_creator_idx').on(table.creatorId),
]);
