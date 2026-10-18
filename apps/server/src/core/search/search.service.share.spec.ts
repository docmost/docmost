import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { SearchService } from './search.service';

const SHARE = {
  id: 'share-1',
  pageId: 'page-1',
  workspaceId: 'ws-1',
  includeSubPages: false,
};

// Kysely over a fake driver that records SQL and returns no rows.
function makeDb() {
  const queries: string[] = [];
  const connection = {
    executeQuery: async (compiled: CompiledQuery) => {
      queries.push(compiled.sql);
      return { rows: [] };
    },
    streamQuery: async function* () {},
  };
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { db, queries };
}

function makeService(unpublished: boolean) {
  const { db, queries } = makeDb();
  const pagePermissionRepo = {
    hasRestrictedAncestor: jest.fn(async () => false),
    hasUnpublishedAncestor: jest.fn(async () => unpublished),
  };
  const service = new SearchService(
    db as any,
    { getPageAndDescendantsExcludingRestricted: jest.fn() } as any,
    { findById: jest.fn(async () => ({ ...SHARE })) } as any,
    {} as any,
    pagePermissionRepo as any,
  );
  return { service, queries, pagePermissionRepo };
}

describe('SearchService share search', () => {
  it('returns nothing for a share whose page is unpublished, without searching', async () => {
    const { service, queries, pagePermissionRepo } = makeService(true);

    const result = await service.searchPage(
      { query: 'secret', shareId: SHARE.id } as any,
      { workspaceId: 'ws-1' },
    );

    expect(result).toEqual({ items: [] });
    expect(pagePermissionRepo.hasUnpublishedAncestor).toHaveBeenCalledWith(
      SHARE.pageId,
    );
    expect(queries).toEqual([]);
  });

  it('searches a share of a published page', async () => {
    const { service, queries } = makeService(false);

    await service.searchPage(
      { query: 'secret', shareId: SHARE.id } as any,
      { workspaceId: 'ws-1' },
    );

    expect(queries.some((sql) => sql.includes('from "pages"'))).toBe(true);
  });
});
