import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('change_requests')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('service_id', 'uuid', (col) =>
      col.notNull().references('services.id'),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.notNull().references('pages.id'),
    )
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('justification', 'text', (col) => col.notNull())
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('DRAFT'))
    .addColumn('priority', 'varchar', (col) => col.notNull())
    .addColumn('impact', 'varchar', (col) => col.notNull())
    .addColumn('requested_by_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('requested_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('approver_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('approved_at', 'timestamptz', (col) => col)
    .addColumn('implementer_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('tech_lead_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('implementation_notes', 'text', (col) => col)
    .addColumn('published_version_id', 'uuid', (col) =>
      col.references('page_history.id'),
    )
    .addColumn('published_at', 'timestamptz', (col) => col)
    .addColumn('closed_at', 'timestamptz', (col) => col)
    .addColumn('due_date', 'timestamptz', (col) => col)
    .addColumn('row_version', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // one active CR per service (partial unique index)
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cr_active_per_service
    ON change_requests (service_id)
    WHERE status IN ('IN_REVIEW','APPROVED','IN_IMPLEMENTATION','IN_VERIFICATION')
  `.execute(db);

  await db.schema
    .createIndex('idx_cr_status_priority')
    .ifNotExists()
    .on('change_requests')
    .columns(['status', 'priority'])
    .execute();

  await db.schema
    .createIndex('idx_cr_requested_by')
    .ifNotExists()
    .on('change_requests')
    .column('requested_by_id')
    .execute();

  await db.schema
    .createIndex('idx_cr_implementer')
    .ifNotExists()
    .on('change_requests')
    .column('implementer_id')
    .execute();

  await db.schema
    .createIndex('idx_cr_approver')
    .ifNotExists()
    .on('change_requests')
    .column('approver_id')
    .execute();

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cr_due_date
    ON change_requests (due_date)
    WHERE status IN ('APPROVED','IN_IMPLEMENTATION')
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('change_requests').execute();
}
