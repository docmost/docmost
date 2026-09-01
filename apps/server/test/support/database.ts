import { CamelCasePlugin, Kysely, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import * as postgres from 'postgres';
import { DbInterface } from '../../src/database/types/db.interface';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set for integration tests');
}

const postgresPool = postgres(databaseUrl, { max: 1, onnotice: () => {} });

export const db = new Kysely<DbInterface>({
  dialect: new PostgresJSDialect({ postgres: postgresPool }),
  plugins: [new CamelCasePlugin()],
});

export async function withStatementTimeout<T>(
  callback: (connection: Kysely<DbInterface>) => Promise<T>,
): Promise<T> {
  return db.connection().execute(async (connection) => {
    await sql`SET statement_timeout = '500ms'`.execute(connection);

    try {
      return await callback(connection);
    } finally {
      await sql`SET statement_timeout = DEFAULT`.execute(connection);
    }
  });
}

export async function truncateFixtureTables(): Promise<void> {
  await sql`TRUNCATE TABLE pages, spaces, workspaces CASCADE`.execute(db);
}

afterEach(async () => {
  await truncateFixtureTables();
});

afterAll(async () => {
  await postgresPool.end();
});
