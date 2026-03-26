import { type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('idx_page_history_page_id')
    .ifNotExists()
    .on('page_history')
    .column('page_id')
    .execute();

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

  await db.schema
    .createIndex('idx_attachments_page_id')
    .ifNotExists()
    .on('attachments')
    .column('page_id')
    .execute();

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
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_pages_creator_id').ifExists().execute();
  await db.schema.dropIndex('idx_pages_workspace_id').ifExists().execute();
  await db.schema.dropIndex('idx_backlinks_target_page_id').ifExists().execute();
  await db.schema.dropIndex('idx_attachments_workspace_id').ifExists().execute();
  await db.schema.dropIndex('idx_attachments_page_id').ifExists().execute();
  await db.schema.dropIndex('idx_space_members_group_id').ifExists().execute();
  await db.schema.dropIndex('idx_space_members_user_id').ifExists().execute();
  await db.schema.dropIndex('idx_group_users_user_id').ifExists().execute();
  await db.schema.dropIndex('idx_page_history_page_id').ifExists().execute();
}
