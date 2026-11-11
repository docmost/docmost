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

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000030';
const PAGE_SPACE_ID = '019a1f00-0000-7000-8000-000000000031';
const OTHER_SPACE_ID = '019a1f00-0000-7000-8000-000000000032';
const PARENT_ID = '019a1f00-0000-7000-8000-000000000033';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000034';
const DETACH_SQL = /^update "pages" set "parent_page_id" = \$1 where "id" = \$2/;

describe('PageRepo restorePage', () => {
  // answers the page and parent lookups by id, and the descendants select with the page alone
  function makeRepo(parent: { space_id: string; deleted_at: Date | null }) {
    const queries: CompiledQuery[] = [];
    const steps: string[] = [];
    const rowsById: Record<string, object> = {
      [PAGE_ID]: {
        id: PAGE_ID,
        parent_page_id: PARENT_ID,
        space_id: PAGE_SPACE_ID,
      },
      [PARENT_ID]: { id: PARENT_ID, ...parent },
    };
    const driver = new DummyDriver();
    driver.acquireConnection = async () =>
      ({
        executeQuery: async (query: CompiledQuery) => {
          if (query.sql.startsWith('with recursive')) {
            return { rows: [{ id: PAGE_ID, space_id: PAGE_SPACE_ID }] };
          }
          if (query.sql.startsWith('select')) {
            const row = rowsById[query.parameters[0] as string];
            return { rows: row ? [row] : [] };
          }
          return { rows: [] };
        },
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
        if (event.level !== 'query') return;
        queries.push(event.query);
        if (DETACH_SQL.test(event.query.sql)) steps.push('detach');
      },
    });
    const pagePermissionRepo = {
      copyInheritedRestriction: jest.fn(async () => {
        steps.push('copy');
      }),
    };

    const repo = new PageRepo(
      db as any,
      {} as any,
      { emit: jest.fn() } as any,
      pagePermissionRepo as any,
    );

    const detachQueries = () =>
      queries.filter((query) => DETACH_SQL.test(query.sql));

    return { repo, queries, steps, detachQueries, pagePermissionRepo };
  }

  it.each([
    ['is in the trash', { space_id: PAGE_SPACE_ID, deleted_at: new Date() }],
    ['sits in another space', { space_id: OTHER_SPACE_ID, deleted_at: null }],
  ])(
    'copies the inherited restriction, then detaches the page when its parent %s',
    async (_case, parent) => {
      const { repo, steps, detachQueries, pagePermissionRepo } =
        makeRepo(parent);

      await repo.restorePage(PAGE_ID, WORKSPACE_ID);

      expect(pagePermissionRepo.copyInheritedRestriction).toHaveBeenCalledWith(
        [PAGE_ID],
        expect.anything(),
      );
      expect(detachQueries()).toEqual([
        expect.objectContaining({ parameters: [null, PAGE_ID] }),
      ]);
      expect(steps).toEqual(['copy', 'detach']);
    },
  );

  it('keeps the page under a live parent in its own space', async () => {
    const { repo, detachQueries, pagePermissionRepo } = makeRepo({
      space_id: PAGE_SPACE_ID,
      deleted_at: null,
    });

    await repo.restorePage(PAGE_ID, WORKSPACE_ID);

    expect(detachQueries()).toEqual([]);
    expect(pagePermissionRepo.copyInheritedRestriction).not.toHaveBeenCalled();
  });

  it('restores only descendants in the same space as their parent', async () => {
    const { repo, queries } = makeRepo({
      space_id: PAGE_SPACE_ID,
      deleted_at: null,
    });

    await repo.restorePage(PAGE_ID, WORKSPACE_ID);

    const descendants = queries.find((query) =>
      query.sql.startsWith('with recursive'),
    );
    expect(descendants.sql).toContain('"p"."space_id" = "pd"."space_id"');
  });
});
