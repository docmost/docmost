import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('legal_holds')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('released_at', 'timestamptz')
    .addColumn('released_by_id', 'uuid', (col) =>
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
    .createIndex('idx_legal_holds_workspace_id')
    .ifNotExists()
    .on('legal_holds')
    .columns(['workspace_id', 'id'])
    .execute();

  await db.schema
    .createIndex('idx_legal_holds_active')
    .ifNotExists()
    .on('legal_holds')
    .column('workspace_id')
    .where(sql.ref('released_at'), 'is', null)
    .execute();

  await db.schema
    .createTable('legal_hold_custodians')
    .ifNotExists()
    .addColumn('legal_hold_id', 'uuid', (col) =>
      col.notNull().references('legal_holds.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('added_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('legal_hold_custodians_pkey', [
      'legal_hold_id',
      'user_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_legal_hold_custodians_workspace_user')
    .ifNotExists()
    .on('legal_hold_custodians')
    .columns(['workspace_id', 'user_id'])
    .execute();

  // No foreign key on space_id, so a deleted space stays listed in the hold
  await db.schema
    .createTable('legal_hold_spaces')
    .ifNotExists()
    .addColumn('legal_hold_id', 'uuid', (col) =>
      col.notNull().references('legal_holds.id').onDelete('cascade'),
    )
    .addColumn('space_id', 'uuid', (col) => col.notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('added_by_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('legal_hold_spaces_pkey', [
      'legal_hold_id',
      'space_id',
    ])
    .execute();

  await db.schema
    .createIndex('idx_legal_hold_spaces_workspace_space')
    .ifNotExists()
    .on('legal_hold_spaces')
    .columns(['workspace_id', 'space_id'])
    .execute();

  await db.schema
    .createTable('preserved_items')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'varchar', (col) => col.notNull())
    .addColumn('item_id', 'uuid', (col) => col.notNull())
    .addColumn('parent_id', 'uuid', (col) =>
      col.references('preserved_items.id').onDelete('cascade'),
    )
    .addColumn('page_id', 'uuid')
    .addColumn('space_id', 'uuid')
    .addColumn('title', 'text')
    .addColumn('user_ids', sql`uuid[]`, (col) =>
      col.notNull().defaultTo(sql`'{}'`),
    )
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('file_path', 'varchar')
    .addColumn('file_size', 'int8')
    .addColumn('actor_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('released_at', 'timestamptz')
    .execute();

  // Preservation relies on ON CONFLICT (item_id) WHERE reason = 'deleted'
  await db.schema
    .createIndex('idx_preserved_items_deleted_item')
    .ifNotExists()
    .unique()
    .on('preserved_items')
    .column('item_id')
    .where(sql.ref('reason'), '=', 'deleted')
    .execute();

  await db.schema
    .createIndex('idx_preserved_items_workspace')
    .ifNotExists()
    .on('preserved_items')
    .columns(['workspace_id', 'id'])
    .where(sql.ref('parent_id'), 'is', null)
    .execute();

  await db.schema
    .createIndex('idx_preserved_items_parent')
    .ifNotExists()
    .on('preserved_items')
    .columns(['parent_id', 'id'])
    .execute();

  await db.schema
    .createIndex('idx_preserved_items_user_ids')
    .ifNotExists()
    .on('preserved_items')
    .using('GIN')
    .column('user_ids')
    .where(sql.ref('parent_id'), 'is', null)
    .execute();

  await db.schema
    .createIndex('idx_preserved_items_space')
    .ifNotExists()
    .on('preserved_items')
    .columns(['workspace_id', 'space_id'])
    .execute();

  await db.schema
    .createIndex('idx_preserved_items_released')
    .ifNotExists()
    .on('preserved_items')
    .column('released_at')
    .where(sql.ref('released_at'), 'is not', null)
    .execute();

  await db.schema
    .createTable('legal_hold_exports')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('legal_hold_id', 'uuid', (col) =>
      col.notNull().references('legal_holds.id').onDelete('cascade'),
    )
    .addColumn('status', 'varchar', (col) => col.notNull())
    .addColumn('file_name', 'varchar', (col) => col.notNull())
    .addColumn('file_path', 'varchar')
    .addColumn('file_size', 'int8')
    .addColumn('error_message', 'text')
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('expires_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_legal_hold_exports_legal_hold_id')
    .ifNotExists()
    .on('legal_hold_exports')
    .columns(['legal_hold_id', 'id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('legal_hold_exports').ifExists().execute();
  await db.schema.dropTable('preserved_items').ifExists().execute();
  await db.schema.dropTable('legal_hold_spaces').ifExists().execute();
  await db.schema.dropTable('legal_hold_custodians').ifExists().execute();
  await db.schema.dropTable('legal_holds').ifExists().execute();
}
