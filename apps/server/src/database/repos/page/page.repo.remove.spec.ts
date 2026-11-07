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

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000020';
const USER_ID = '019a1f00-0000-7000-8000-000000000021';
const ROOT_ID = '019a1f00-0000-7000-8000-000000000022';
const CHILD_ID = '019a1f00-0000-7000-8000-000000000023';

describe('PageRepo removePage', () => {
  // answers the recursive descendants select with the root and its child, everything else with no rows
  function makeRepo() {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () =>
      ({
        executeQuery: async (query: CompiledQuery) => ({
          rows: query.sql.startsWith('with recursive')
            ? [{ id: ROOT_ID }, { id: CHILD_ID }]
            : [],
        }),
        streamQuery: async function* () {},
      }) as any;
    const db = new Kysely<any>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => driver,
        createIntrospector: (kysely) => new PostgresIntrospector(kysely),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
      plugins: [new CamelCasePlugin()],
      log: (event) => {
        if (event.level === 'query') queries.push(event.query);
      },
    });

    const repo = new PageRepo(db as any, {} as any, { emit: jest.fn() } as any);

    return { repo, queries };
  }

  it('clears the space home when its page or an ancestor is trashed', async () => {
    const { repo, queries } = makeRepo();

    await repo.removePage(ROOT_ID, USER_ID, WORKSPACE_ID);

    const homeClears = queries.filter((query) =>
      /^update "spaces" set "home_page_id" = .+ where "home_page_id" in \(/.test(
        query.sql,
      ),
    );
    expect(homeClears).toHaveLength(1);
    expect(homeClears[0].parameters[0]).toBeNull();
    expect(homeClears[0].parameters).toEqual(
      expect.arrayContaining([ROOT_ID, CHILD_ID]),
    );
  });
});
