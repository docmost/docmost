import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

/**
 * Creates the NIS-2 compliance tables idempotently on startup instead of via a
 * tracked Kysely migration. This keeps the fork's schema out of the
 * `kysely_migration` ledger so the stock Docmost image can boot against the
 * same database without hitting "corrupted/missing migration" errors — the two
 * images can be swapped in either direction freely. The extra tables are simply
 * ignored by the stock image.
 */
@Injectable()
export class ComplianceSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ComplianceSchemaService.name);

  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async onApplicationBootstrap() {
    const retryAttempts = 10;
    const retryDelay = 2000;

    for (let i = 0; i < retryAttempts; i++) {
      try {
        await this.ensureSchema();
        this.logger.log('NIS-2 compliance schema ensured');
        return;
      } catch (err) {
        if (i < retryAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error('Failed to ensure NIS-2 compliance schema', err);
        }
      }
    }
  }

  private async ensureSchema() {
    await this.db.schema
      .createTable('change_sets')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
      )
      .addColumn('page_id', 'uuid', (col) =>
        col.references('pages.id').onDelete('cascade'),
      )
      .addColumn('space_id', 'uuid', (col) =>
        col.references('spaces.id').onDelete('cascade'),
      )
      .addColumn('workspace_id', 'uuid', (col) =>
        col.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('reason', 'text', (col) => col.notNull())
      .addColumn('requested_by', 'varchar', (col) => col.notNull())
      .addColumn('target_system', 'varchar', (col) => col)
      .addColumn('ticket_ref', 'varchar', (col) => col)
      .addColumn('performed_by_id', 'uuid', (col) =>
        col.references('users.id').onDelete('set null'),
      )
      .addColumn('corrects_id', 'uuid', (col) =>
        col.references('change_sets.id').onDelete('set null'),
      )
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addCheckConstraint(
        'change_sets_page_or_space_check',
        sql`((page_id IS NOT NULL AND space_id IS NULL) OR (page_id IS NULL AND space_id IS NOT NULL))`,
      )
      .execute();

    await this.db.schema
      .createTable('change_entries')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
      )
      .addColumn('change_set_id', 'uuid', (col) =>
        col.notNull().references('change_sets.id').onDelete('cascade'),
      )
      .addColumn('summary', 'text', (col) => col.notNull())
      .addColumn('detail', 'text', (col) => col)
      .addColumn('position', 'int4', (col) => col)
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .execute();

    await this.db.schema
      .createTable('change_log_settings')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
      )
      .addColumn('page_id', 'uuid', (col) =>
        col.references('pages.id').onDelete('cascade'),
      )
      .addColumn('space_id', 'uuid', (col) =>
        col.references('spaces.id').onDelete('cascade'),
      )
      .addColumn('workspace_id', 'uuid', (col) =>
        col.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('enabled', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addColumn('updated_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addCheckConstraint(
        'change_log_settings_page_or_space_check',
        sql`((page_id IS NOT NULL AND space_id IS NULL) OR (page_id IS NULL AND space_id IS NOT NULL))`,
      )
      .execute();

    await this.db.schema
      .createTable('review_settings')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
      )
      .addColumn('page_id', 'uuid', (col) =>
        col.references('pages.id').onDelete('cascade'),
      )
      .addColumn('space_id', 'uuid', (col) =>
        col.references('spaces.id').onDelete('cascade'),
      )
      .addColumn('workspace_id', 'uuid', (col) =>
        col.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('interval_days', 'int4', (col) => col.notNull())
      .addColumn('last_reviewed_at', 'timestamptz', (col) => col)
      .addColumn('last_reviewed_by_id', 'uuid', (col) =>
        col.references('users.id').onDelete('set null'),
      )
      .addColumn('next_review_at', 'timestamptz', (col) => col)
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addColumn('updated_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addCheckConstraint(
        'review_settings_page_or_space_check',
        sql`((page_id IS NOT NULL AND space_id IS NULL) OR (page_id IS NULL AND space_id IS NOT NULL))`,
      )
      .execute();

    await this.db.schema
      .createTable('review_records')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) =>
        col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
      )
      .addColumn('review_setting_id', 'uuid', (col) =>
        col.notNull().references('review_settings.id').onDelete('cascade'),
      )
      .addColumn('page_id', 'uuid', (col) =>
        col.references('pages.id').onDelete('set null'),
      )
      .addColumn('space_id', 'uuid', (col) =>
        col.references('spaces.id').onDelete('set null'),
      )
      .addColumn('workspace_id', 'uuid', (col) =>
        col.notNull().references('workspaces.id').onDelete('cascade'),
      )
      .addColumn('reviewed_by_id', 'uuid', (col) =>
        col.references('users.id').onDelete('set null'),
      )
      .addColumn('reviewed_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .addColumn('note', 'text', (col) => col)
      .addColumn('created_at', 'timestamptz', (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .execute();

    await this.createIndexIfNotExists(
      'idx_change_sets_page',
      'change_sets',
      (b) => b.column('page_id'),
    );
    await this.createIndexIfNotExists(
      'idx_change_sets_space',
      'change_sets',
      (b) => b.column('space_id'),
    );
    await this.createIndexIfNotExists(
      'idx_change_sets_workspace',
      'change_sets',
      (b) => b.column('workspace_id'),
    );
    await this.createIndexIfNotExists(
      'idx_change_entries_change_set',
      'change_entries',
      (b) => b.column('change_set_id'),
    );
    await this.createIndexIfNotExists(
      'idx_change_log_settings_page',
      'change_log_settings',
      (b) => b.column('page_id').unique().where('page_id', 'is not', null),
    );
    await this.createIndexIfNotExists(
      'idx_change_log_settings_space',
      'change_log_settings',
      (b) => b.column('space_id').unique().where('space_id', 'is not', null),
    );
    await this.createIndexIfNotExists(
      'idx_change_log_settings_workspace',
      'change_log_settings',
      (b) => b.column('workspace_id'),
    );
    await this.createIndexIfNotExists(
      'idx_review_settings_page',
      'review_settings',
      (b) => b.column('page_id').unique().where('page_id', 'is not', null),
    );
    await this.createIndexIfNotExists(
      'idx_review_settings_space',
      'review_settings',
      (b) => b.column('space_id').unique().where('space_id', 'is not', null),
    );
    await this.createIndexIfNotExists(
      'idx_review_settings_workspace',
      'review_settings',
      (b) => b.column('workspace_id'),
    );
    await this.createIndexIfNotExists(
      'idx_review_settings_next_review',
      'review_settings',
      (b) => b.column('next_review_at').where('next_review_at', 'is not', null),
    );
    await this.createIndexIfNotExists(
      'idx_review_records_setting',
      'review_records',
      (b) => b.column('review_setting_id'),
    );
  }

  private async createIndexIfNotExists(
    name: string,
    table: string,
    build: (builder: any) => any,
  ) {
    await build(
      this.db.schema.createIndex(name).ifNotExists().on(table),
    ).execute();
  }
}
