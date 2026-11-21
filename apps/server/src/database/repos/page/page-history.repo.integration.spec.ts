import { CamelCasePlugin, Kysely, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres = require('postgres');
import { PaginationOptions } from '../../pagination/pagination-options';
import type { DbInterface } from '../../types/db.interface';
import { PageHistoryRepo } from './page-history.repo';

const databaseUrl = process.env.PAGE_HISTORY_TEST_DATABASE_URL;

(databaseUrl ? describe : describe.skip)(
  'PageHistoryRepo in PostgreSQL',
  () => {
    let db: Kysely<DbInterface>;

    beforeAll(() => {
      db = new Kysely<DbInterface>({
        dialect: new PostgresJSDialect({
          postgres: postgres(databaseUrl, { max: 1 }),
        }),
        plugins: [new CamelCasePlugin()],
      });
    });

    afterAll(async () => db.destroy());

    async function withHistory(
      verify: (repo: PageHistoryRepo) => Promise<void>,
    ) {
      const rollback = new Error('rollback history fixtures');
      await expect(
        db.transaction().execute(async (trx) => {
          await sql`create temporary table users (
          id text primary key, name text, avatar_url text
        ) on commit drop`.execute(trx);
          await sql`create temporary table page_history (
          id text primary key, page_id text, slug_id text, title text,
          icon text, cover_photo text, last_updated_by_id text,
          contributor_ids text[], space_id text, workspace_id text,
          created_at timestamptz, version integer, content jsonb
        ) on commit drop`.execute(trx);
          await sql`insert into users (id, name) values ('author', 'Source Author')`.execute(
            trx,
          );
          await sql`insert into page_history
          (id, page_id, created_at, version, last_updated_by_id)
          values
            ('01', 'page', '2026-01-01', 3, 'author'),
            ('02', 'page', '2026-01-01', 4, null),
            ('03', 'page', '2026-01-01', 5, null),
            ('native', 'native-page', '2026-01-01', null, null)`.execute(trx);

          await verify(new PageHistoryRepo(trx));
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    }

    it('returns the stored version in history detail and listing', async () => {
      await withHistory(async (repo) => {
        expect(await repo.findById('01')).toMatchObject({ version: 3 });
        const history = await repo.findPageHistoryByPageId(
          'page',
          new PaginationOptions(),
        );
        expect(history.items.map((row) => [row.id, row.version])).toEqual([
          ['03', 5],
          ['02', 4],
          ['01', 3],
        ]);
      });
    });

    it('selects the greatest id as the latest when timestamps tie', async () => {
      await withHistory(async (repo) => {
        expect(await repo.findPageLastHistory('page')).toMatchObject({
          id: '03',
        });
      });
    });

    it('displays a missing author only for numbered history', async () => {
      await withHistory(async (repo) => {
        expect(await repo.findById('01')).toMatchObject({
          lastUpdatedBy: {
            id: 'author',
            name: 'Source Author',
            avatarUrl: null,
          },
        });
        expect(await repo.findById('02')).toMatchObject({
          lastUpdatedById: null,
          lastUpdatedBy: { id: null, name: 'Unknown User', avatarUrl: null },
        });
        expect(await repo.findById('native')).toMatchObject({
          lastUpdatedBy: null,
        });
      });
    });
  },
);
