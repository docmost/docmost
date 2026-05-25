import * as path from 'path';
import { promises as fs } from 'fs';
import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { run } from 'kysely-migration-cli';
import * as dotenv from 'dotenv';
import { envPath, normalizePostgresUrl } from '../common/helpers';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

dotenv.config({ path: envPath });

const migrationFolder = path.join(__dirname, '../database/migrations-docops');

const db = new Kysely<any>({
  dialect: new PostgresJSDialect({
    postgres: postgres(normalizePostgresUrl(process.env.DATABASE_URL)),
  }),
});

// Uses a separate kysely_migration table to avoid collisions with upstream migrations
const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
  migrationTableName: 'kysely_migration_docops',
  migrationLockTableName: 'kysely_migration_lock_docops',
});

run(db, migrator, migrationFolder);
