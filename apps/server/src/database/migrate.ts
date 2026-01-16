import * as path from 'path';
import { promises as fs } from 'fs';
import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { run } from 'kysely-migration-cli';
import * as dotenv from 'dotenv';
import { envPath, normalizePostgresUrl } from '../common/helpers';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

dotenv.config({ path: envPath });

const migrationFolder = path.join(__dirname, './migrations');

const db = new Kysely<any>({
  dialect: new PostgresJSDialect({
    postgres: postgres(normalizePostgresUrl(process.env.DATABASE_URL)),
  }),
});

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
});

run(db, migrator, migrationFolder);
