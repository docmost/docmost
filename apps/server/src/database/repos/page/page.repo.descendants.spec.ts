import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PageRepo } from './page.repo';

const SPACE_ID = '019a1f00-0000-7000-8000-000000000040';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000041';

describe('PageRepo page trees', () => {
  function makeRepo() {
    const queries: CompiledQuery[] = [];
    const db = new Kysely<any>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => new DummyDriver(),
        createIntrospector: (kysely) => new PostgresIntrospector(kysely),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
      plugins: [new CamelCasePlugin()],
      log: (event) => {
        if (event.level === 'query') queries.push(event.query);
      },
    });

    const repo = new PageRepo(
      db as any,
      {} as any,
      { emit: jest.fn() } as any,
      {} as any,
    );

    return { repo, queries };
  }

  it.each([
    [
      'getPageAndDescendants',
      (repo: PageRepo) =>
        repo.getPageAndDescendants(PAGE_ID, { includeContent: false }),
    ],
    [
      'getPageAndDescendantsExcludingRestricted',
      (repo: PageRepo) =>
        repo.getPageAndDescendantsExcludingRestricted(PAGE_ID, {
          includeContent: false,
        }),
    ],
    [
      'getSpacePagesExcludingRestricted',
      (repo: PageRepo) => repo.getSpacePagesExcludingRestricted(SPACE_ID),
    ],
  ])('%s only follows children in the same space', async (_name, run) => {
    const { repo, queries } = makeRepo();

    await run(repo);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"p"."space_id" = "ph"."space_id"');
  });
});
