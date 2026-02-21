import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  name: text('name'),
  description: text('description'),
  logo: text('logo'),
  hostname: text('hostname'),
  customDomain: text('custom_domain'),
  settings: text('settings', { mode: 'json' }),
  defaultRole: text('default_role').notNull().default('member'),
  emailDomains: text('email_domains', { mode: 'json' }).$type<string[]>(),
  defaultSpaceId: text('default_space_id'),
  status: text('status'),
  plan: text('plan'),
  trialEndAt: text('trial_end_at'),
  enforceSso: integer('enforce_sso', { mode: 'boolean' }).notNull().default(false),
  enforceMfa: integer('enforce_mfa', { mode: 'boolean' }),
  licenseKey: text('license_key'),
  billingEmail: text('billing_email'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
}, (table) => [
  uniqueIndex('workspaces_hostname_idx').on(table.hostname),
  uniqueIndex('workspaces_custom_domain_idx').on(table.customDomain),
]);

export const workspaceInvitations = sqliteTable('workspace_invitations', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  email: text('email'),
  role: text('role').notNull().default('member'),
  token: text('token').notNull(),
  groupIds: text('group_ids', { mode: 'json' }).$type<string[]>(),
  invitedById: text('invited_by_id'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex('workspace_invitations_token_idx').on(table.token),
  index('workspace_invitations_workspace_idx').on(table.workspaceId),
]);
