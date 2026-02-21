import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';
import { workspaces } from './workspaces';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  email: text('email').notNull(),
  name: text('name'),
  password: text('password'),
  role: text('role'),
  avatarUrl: text('avatar_url'),
  emailVerifiedAt: text('email_verified_at'),
  lastLoginAt: text('last_login_at'),
  lastActiveAt: text('last_active_at'),
  deactivatedAt: text('deactivated_at'),
  locale: text('locale'),
  timezone: text('timezone'),
  settings: text('settings', { mode: 'json' }),
  hasGeneratedPassword: integer('has_generated_password', { mode: 'boolean' }),
  invitedById: text('invited_by_id'),
  workspaceId: text('workspace_id').references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('users_workspace_idx').on(table.workspaceId),
  index('users_email_workspace_idx').on(table.email, table.workspaceId),
]);

export const userTokens = sqliteTable('user_tokens', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  token: text('token').notNull(),
  type: text('type').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at'),
  usedAt: text('used_at'),
  workspaceId: text('workspace_id').references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex('user_tokens_token_idx').on(table.token),
  index('user_tokens_user_idx').on(table.userId),
]);

export const userMfa = sqliteTable('user_mfa', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  userId: text('user_id').notNull().references(() => users.id),
  method: text('method').notNull().default('totp'),
  secret: text('secret'),
  backupCodes: text('backup_codes', { mode: 'json' }).$type<string[]>(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('user_mfa_user_idx').on(table.userId),
]);
