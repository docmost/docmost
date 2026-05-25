import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('services')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('code', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col)
    .addColumn('domain', 'varchar', (col) => col)
    .addColumn('owner_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('lifecycle_state', 'varchar', (col) =>
      col.notNull().defaultTo('active'),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.notNull().references('spaces.id').unique(),
    )
    .addColumn('root_page_id', 'uuid', (col) => col.references('pages.id'))
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_services_code')
    .ifNotExists()
    .on('services')
    .column('code')
    .execute();

  await db.schema
    .createIndex('idx_services_owner')
    .ifNotExists()
    .on('services')
    .column('owner_id')
    .execute();

  await db.schema
    .createIndex('idx_services_lifecycle')
    .ifNotExists()
    .on('services')
    .column('lifecycle_state')
    .execute();

  await db.schema
    .createIndex('idx_services_domain')
    .ifNotExists()
    .on('services')
    .column('domain')
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_services_fts
    ON services USING GIN (to_tsvector('italian', name || ' ' || coalesce(description, '')))
  `.execute(db);

  // tags
  await db.schema
    .createTable('tags')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar', (col) => col.notNull().unique())
    .execute();

  // service_tags many-to-many
  await db.schema
    .createTable('service_tags')
    .ifNotExists()
    .addColumn('service_id', 'uuid', (col) =>
      col.notNull().references('services.id').onDelete('cascade'),
    )
    .addColumn('tag_id', 'uuid', (col) =>
      col.notNull().references('tags.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('service_tags_pk', ['service_id', 'tag_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('service_tags').execute();
  await db.schema.dropTable('tags').execute();
  await db.schema.dropTable('services').execute();
}
