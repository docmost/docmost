import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('announcements')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('color', 'varchar', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('text_content', 'text', (col) => col.notNull())
    .addColumn('tsv', sql`tsvector`, (col) => col)
    .addColumn('is_dismissible', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('audience', 'varchar', (col) =>
      col.notNull().defaultTo('members'),
    )
    .addColumn('starts_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('ends_at', 'timestamptz')
    .addColumn('archived_at', 'timestamptz')
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('last_updated_by_id', 'uuid', (col) =>
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
    .createIndex('idx_announcements_workspace_id')
    .ifNotExists()
    .on('announcements')
    .columns(['workspace_id'])
    .execute();

  await db.schema
    .createIndex('idx_announcements_current')
    .ifNotExists()
    .on('announcements')
    .columns(['workspace_id', 'starts_at', 'id'])
    .where(sql.ref('archived_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('idx_announcements_tsv')
    .ifNotExists()
    .on('announcements')
    .using('GIN')
    .column('tsv')
    .execute();

  await sql`
    CREATE OR REPLACE FUNCTION announcements_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.text_content, ''))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`CREATE OR REPLACE TRIGGER announcements_tsvector_update BEFORE INSERT OR UPDATE OF title, text_content
                ON announcements FOR EACH ROW EXECUTE FUNCTION announcements_tsvector_trigger();`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('announcements').ifExists().execute();
  await sql`DROP FUNCTION IF EXISTS announcements_tsvector_trigger`.execute(db);
}
