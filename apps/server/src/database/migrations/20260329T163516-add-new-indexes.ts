import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('idx_group_users_user_id')
    .ifNotExists()
    .on('group_users')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_space_members_user_id')
    .ifNotExists()
    .on('space_members')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_space_members_group_id')
    .ifNotExists()
    .on('space_members')
    .column('group_id')
    .execute();

  // Page tree
  await sql`
    CREATE INDEX IF NOT EXISTS idx_pages_space_parent_position
    ON pages (space_id, parent_page_id, position COLLATE "C")
    WHERE deleted_at IS NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_pages_parent_page_id
    ON pages (parent_page_id)
    WHERE deleted_at IS NULL
  `.execute(db);

  // Recent pages query
  await sql`
    CREATE INDEX IF NOT EXISTS idx_pages_space_updated
    ON pages (space_id, updated_at DESC)
    WHERE deleted_at IS NULL
  `.execute(db);

  // Trash view
  await sql`
    CREATE INDEX IF NOT EXISTS idx_pages_space_deleted
    ON pages (space_id, deleted_at DESC)
    WHERE deleted_at IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_hostname_lower
    ON workspaces (LOWER(hostname))
  `.execute(db);

  await db.schema
    .createIndex('idx_workspaces_created_at')
    .ifNotExists()
    .on('workspaces')
    .column('created_at')
    .execute();

  await db.schema
    .createIndex('idx_users_workspace_deleted')
    .ifNotExists()
    .on('users')
    .columns(['workspace_id', 'deleted_at'])
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_slug_lower_workspace
    ON spaces (LOWER(slug), workspace_id)
  `.execute(db);

  await db.schema
    .createIndex('idx_spaces_workspace_id')
    .ifNotExists()
    .on('spaces')
    .column('workspace_id')
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_name_lower_workspace
    ON groups (LOWER(name), workspace_id)
  `.execute(db);

  await db.schema
    .createIndex('idx_groups_workspace_id')
    .ifNotExists()
    .on('groups')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('idx_shares_page_id')
    .ifNotExists()
    .on('shares')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_attachments_page_id')
    .ifNotExists()
    .on('attachments')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_attachments_space_id')
    .ifNotExists()
    .on('attachments')
    .column('space_id')
    .execute();

  await db.schema
    .createIndex('idx_comments_page_id')
    .ifNotExists()
    .on('comments')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_comments_parent_comment_id')
    .ifNotExists()
    .on('comments')
    .column('parent_comment_id')
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_page_history_page_created
    ON page_history (page_id, created_at DESC)
  `.execute(db);

  await db.schema
    .createIndex('idx_attachments_workspace_id')
    .ifNotExists()
    .on('attachments')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('idx_backlinks_target_page_id')
    .ifNotExists()
    .on('backlinks')
    .column('target_page_id')
    .execute();

  await db.schema
    .createIndex('idx_pages_workspace_id')
    .ifNotExists()
    .on('pages')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('idx_pages_creator_id')
    .ifNotExists()
    .on('pages')
    .column('creator_id')
    .execute();

  // Notifications: FK cascade from pages, spaces, comments
  await db.schema
    .createIndex('idx_notifications_page_id')
    .ifNotExists()
    .on('notifications')
    .column('page_id')
    .execute();

  await db.schema
    .createIndex('idx_notifications_space_id')
    .ifNotExists()
    .on('notifications')
    .column('space_id')
    .execute();

  await db.schema
    .createIndex('idx_notifications_comment_id')
    .ifNotExists()
    .on('notifications')
    .column('comment_id')
    .execute();

  // Watchers: cleanup queries and FK cascade
  await db.schema
    .createIndex('idx_watchers_user_workspace')
    .ifNotExists()
    .on('watchers')
    .columns(['user_id', 'workspace_id'])
    .execute();

  await db.schema
    .createIndex('idx_watchers_space_id')
    .ifNotExists()
    .on('watchers')
    .column('space_id')
    .execute();

  // Auth providers: all queries filter by workspaceId
  await db.schema
    .createIndex('idx_auth_providers_workspace_id')
    .ifNotExists()
    .on('auth_providers')
    .column('workspace_id')
    .execute();

  // Auth accounts: SSO login lookup by provider user
  await db.schema
    .createIndex('idx_auth_accounts_provider_user_id')
    .ifNotExists()
    .on('auth_accounts')
    .columns(['provider_user_id', 'auth_provider_id'])
    .execute();

  // Workspace invitations: listing and SSO lookup
  await db.schema
    .createIndex('idx_workspace_invitations_workspace_id')
    .ifNotExists()
    .on('workspace_invitations')
    .column('workspace_id')
    .execute();

  // API keys: query and FK cascade
  await db.schema
    .createIndex('idx_api_keys_workspace_id')
    .ifNotExists()
    .on('api_keys')
    .column('workspace_id')
    .execute();

  // User sessions: delete queries and FK cascade on all session states
  await db.schema
    .createIndex('idx_user_sessions_user_workspace')
    .ifNotExists()
    .on('user_sessions')
    .columns(['user_id', 'workspace_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_group_users_user_id').ifExists().execute();
  await db.schema.dropIndex('idx_space_members_user_id').ifExists().execute();
  await db.schema.dropIndex('idx_space_members_group_id').ifExists().execute();
  await db.schema
    .dropIndex('idx_pages_space_parent_position')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_pages_parent_page_id').ifExists().execute();
  await db.schema.dropIndex('idx_pages_space_updated').ifExists().execute();
  await db.schema.dropIndex('idx_pages_space_deleted').ifExists().execute();
  await db.schema
    .dropIndex('idx_workspaces_hostname_lower')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_workspaces_created_at').ifExists().execute();
  await db.schema
    .dropIndex('idx_users_workspace_deleted')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_spaces_slug_lower_workspace')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_spaces_workspace_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_groups_name_lower_workspace')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_groups_workspace_id').ifExists().execute();
  await db.schema.dropIndex('idx_shares_page_id').ifExists().execute();
  await db.schema.dropIndex('idx_attachments_page_id').ifExists().execute();
  await db.schema.dropIndex('idx_attachments_space_id').ifExists().execute();
  await db.schema.dropIndex('idx_comments_page_id').ifExists().execute();
  await db.schema
    .dropIndex('idx_comments_parent_comment_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_page_history_page_created')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_attachments_workspace_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_backlinks_target_page_id')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_pages_workspace_id').ifExists().execute();
  await db.schema.dropIndex('idx_pages_creator_id').ifExists().execute();
  await db.schema
    .dropIndex('idx_notifications_page_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_notifications_space_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_notifications_comment_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_watchers_user_workspace')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_watchers_space_id').ifExists().execute();
  await db.schema
    .dropIndex('idx_auth_providers_workspace_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_auth_accounts_provider_user_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_workspace_invitations_workspace_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_api_keys_workspace_id')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_user_sessions_user_workspace')
    .ifExists()
    .execute();
}
