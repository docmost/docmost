import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { DB } from '@docmost/db/types/db';
import { verifiedPageFilter } from './verified-page-filter';

const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (kysely) => new PostgresIntrospector(kysely),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
  plugins: [new CamelCasePlugin()],
});

describe('verifiedPageFilter', () => {
  it('matches approved QMS pages and unexpired, unedited verifications', () => {
    const now = new Date('2026-11-25T12:00:00.000Z');
    const { sql, parameters } = db
      .selectFrom('pages')
      .select('pages.id')
      .where((eb) => verifiedPageFilter(eb, now))
      .compile();

    expect(sql).toBe(
      'select "pages"."id" from "pages" where exists (' +
        'select "page_verifications"."id" from "page_verifications" ' +
        'where "page_verifications"."page_id" = "pages"."id" ' +
        'and "page_verifications"."workspace_id" = "pages"."workspace_id" and (' +
        '("page_verifications"."type" = $1 and "page_verifications"."status" = $2) or (' +
        '"page_verifications"."type" <> $3 and "page_verifications"."invalidated_at" is null and (' +
        '"page_verifications"."expires_at" is null or "page_verifications"."expires_at" > $4))))',
    );
    expect(parameters).toEqual(['qms', 'approved', 'qms', now]);
  });

  it('compares expiry with the app clock by default, like the badge status', () => {
    const before = Date.now();
    const { parameters } = db
      .selectFrom('pages')
      .select('pages.id')
      .where((eb) => verifiedPageFilter(eb))
      .compile();

    const comparedWith = (parameters[3] as Date).getTime();
    expect(comparedWith).toBeGreaterThanOrEqual(before);
    expect(comparedWith).toBeLessThanOrEqual(Date.now());
  });
});
