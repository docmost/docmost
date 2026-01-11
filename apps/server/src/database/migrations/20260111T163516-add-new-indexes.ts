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
    .createIndex('idx_users_workspace_deleted_created')
    .ifNotExists()
    .on('users')
    .columns(['workspace_id', 'deleted_at', 'created_at'])
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_users_workspace_email_lower
    ON users (workspace_id, LOWER(email))
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_workspace_slug_lower
    ON spaces (workspace_id, LOWER(slug))
  `.execute(db);

  await db.schema
    .createIndex('idx_spaces_workspace_created')
    .ifNotExists()
    .on('spaces')
    .columns(['workspace_id', 'created_at'])
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_workspace_name_lower
    ON groups (workspace_id, LOWER(name))
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

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_key_lower
    ON shares (LOWER(key))
  `.execute(db);

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
    .columns(['page_id', 'created_at'])
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
    .dropIndex('idx_users_workspace_deleted_created')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_users_workspace_email_lower')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_spaces_workspace_slug_lower')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_spaces_workspace_created')
    .ifExists()
    .execute();
  await db.schema
    .dropIndex('idx_groups_workspace_name_lower')
    .ifExists()
    .execute();
  await db.schema.dropIndex('idx_groups_workspace_id').ifExists().execute();
  await db.schema.dropIndex('idx_shares_page_id').ifExists().execute();
  await db.schema.dropIndex('idx_shares_key_lower').ifExists().execute();
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
}
