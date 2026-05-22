import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_verifications')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().unique().references('pages.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.notNull().references('spaces.id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar', (col) => col.notNull().defaultTo('expiring'))
    .addColumn('status', 'varchar')
    .addColumn('mode', 'varchar')
    .addColumn('period_amount', 'integer')
    .addColumn('period_unit', 'varchar')
    .addColumn('verified_at', 'timestamptz')
    .addColumn('verified_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('expires_at', 'timestamptz')
    .addColumn('requested_at', 'timestamptz')
    .addColumn('requested_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('rejected_at', 'timestamptz')
    .addColumn('rejected_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('rejection_comment', 'text')
    .addColumn('data', 'jsonb')
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('page_verifiers')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_verification_id', 'uuid', (col) =>
      col.notNull().references('page_verifications.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('is_primary', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('added_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint('page_verifiers_verification_user_unique', [
      'page_verification_id',
      'user_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_page_verifications_expires_at')
    .ifNotExists()
    .on('page_verifications')
    .column('expires_at')
    .where('expires_at', 'is not', null)
    .execute();

  await db.schema
    .createIndex('idx_page_verifications_workspace_id_id')
    .ifNotExists()
    .on('page_verifications')
    .columns(['workspace_id', 'id desc'])
    .execute();

  await db.schema
    .createIndex('idx_page_verifications_space_id')
    .ifNotExists()
    .on('page_verifications')
    .column('space_id')
    .execute();

  await db.schema
    .createIndex('idx_page_verifiers_user_id')
    .ifNotExists()
    .on('page_verifiers')
    .column('user_id')
    .execute();

  await db.schema
    .alterTable('notifications')
    .addColumn('page_verification_id', 'uuid', (col) =>
      col.references('page_verifications.id').onDelete('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('notifications')
    .dropColumn('page_verification_id')
    .execute();
  await db.schema.dropTable('page_verifiers').ifExists().execute();
  await db.schema.dropTable('page_verifications').ifExists().execute();
}
