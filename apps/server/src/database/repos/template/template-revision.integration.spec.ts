import { CamelCasePlugin, Kysely, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres = require('postgres');
import type { DbInterface } from '../../types/db.interface';
import { TemplateRepo } from './template.repo';

const databaseUrl = process.env.TEMPLATE_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)(
  'template revision in PostgreSQL',
  () => {
    it('advances the millisecond revision on every save, even if the previous write is ahead of the clock', async () => {
      const db = new Kysely<DbInterface>({
        dialect: new PostgresJSDialect({
          postgres: postgres(databaseUrl, { max: 1 }),
        }),
        plugins: [new CamelCasePlugin()],
      });
      try {
        await db.transaction().execute(async (trx) => {
          await sql`create temporary table templates (
          id text primary key, workspace_id text, title text, updated_at timestamptz
        ) on commit drop`.execute(trx);
          const first = await trx
            .insertInto('templates')
            .values({
              id: 'template',
              workspaceId: 'workspace',
              updatedAt: sql<Date>`now() + interval '1 day'`,
            })
            .returning('updatedAt')
            .executeTakeFirstOrThrow();
          const repo = new TemplateRepo(db);
          let previous = first.updatedAt.getTime();
          for (const title of ['First edit', 'Second edit']) {
            await repo.updateTemplate({ title }, 'template', 'workspace', trx);
            const row = await trx
              .selectFrom('templates')
              .select('updatedAt')
              .executeTakeFirstOrThrow();
            expect(row.updatedAt.getTime()).toBeGreaterThan(previous);
            previous = row.updatedAt.getTime();
          }
        });
      } finally {
        await db.destroy();
      }
    });
  },
);
