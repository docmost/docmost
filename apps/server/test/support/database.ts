import { CamelCasePlugin, Kysely, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import * as postgres from 'postgres';
import { DbInterface } from '../../src/database/types/db.interface';

const disposableDatabaseName = 'docmost_cycle_test';
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set for integration tests');
}

export function assertDisposableTestDatabaseUrl(value: string): void {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }

  const isPostgresUrl = ['postgres:', 'postgresql:'].includes(
    parsedUrl.protocol,
  );
  const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(
    parsedUrl.hostname,
  );
  const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));

  if (!isPostgresUrl || !isLoopback || databaseName !== disposableDatabaseName) {
    throw new Error(
      `Integration tests require the loopback database ${disposableDatabaseName}`,
    );
  }
}

assertDisposableTestDatabaseUrl(databaseUrl);

const postgresPool = postgres(databaseUrl, { max: 1, onnotice: () => {} });

export const db = new Kysely<DbInterface>({
  dialect: new PostgresJSDialect({ postgres: postgresPool }),
  plugins: [new CamelCasePlugin()],
});

let databaseSafetyVerified = false;

beforeAll(async () => {
  const result = await sql<{ databaseName: string }>`
    SELECT current_database() AS "databaseName"
  `.execute(db);

  if (result.rows[0]?.databaseName !== disposableDatabaseName) {
    throw new Error(
      `Connected database must be the disposable ${disposableDatabaseName} database`,
    );
  }

  databaseSafetyVerified = true;
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
  if (!databaseSafetyVerified) {
    throw new Error('Refusing to truncate an unverified integration database');
  }

  await sql`TRUNCATE TABLE pages, spaces, workspaces CASCADE`.execute(db);
}

afterEach(async () => {
  await truncateFixtureTables();
});

afterAll(async () => {
  await postgresPool.end();
});
