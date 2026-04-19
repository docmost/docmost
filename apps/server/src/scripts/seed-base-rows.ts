import * as path from 'path';
import * as dotenv from 'dotenv';
import { Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { seedBase } from '../core/base/query-cache/testing/seed-base';

const TOTAL_ROWS = Number(process.env.TOTAL_ROWS) || 1500;

const envFilePath = path.resolve(process.cwd(), '..', '..', '.env');
dotenv.config({ path: envFilePath });

function normalizePostgresUrl(url: string): string {
  const parsed = new URL(url);
  const newParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams) {
    if (key === 'sslmode' && value === 'no-verify') continue;
    if (key === 'schema') continue;
    newParams.append(key, value);
  }
  parsed.search = newParams.toString();
  return parsed.toString();
}

const db = new Kysely<any>({
  dialect: new PostgresJSDialect({
    postgres: postgres(normalizePostgresUrl(process.env.DATABASE_URL!)),
  }),
});

async function main() {
  const spaceId = '019c69a3-dd47-7014-8b87-ec8f167577ee';

  const space = await db
    .selectFrom('spaces')
    .select(['id', 'workspace_id'])
    .where('id', '=', spaceId)
    .executeTakeFirstOrThrow();

  const workspaceId = space.workspace_id;

  const user = await db
    .selectFrom('users')
    .select('id')
    .limit(1)
    .executeTakeFirst();

  const creatorUserId = user?.id ?? null;

  console.log(`Workspace: ${workspaceId}`);
  console.log(`Space: ${spaceId}`);
  console.log(`Creator: ${creatorUserId ?? '(none)'}\n`);

  const startTime = Date.now();
  const { baseId } = await seedBase({
    db,
    workspaceId,
    spaceId,
    creatorUserId,
    rows: TOTAL_ROWS,
  });
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `Inserted ${TOTAL_ROWS.toLocaleString()} rows in ${totalElapsed}s`,
  );
  console.log(`Base ID: ${baseId}`);

  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  db.destroy().finally(() => process.exit(1));
});
