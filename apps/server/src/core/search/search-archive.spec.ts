import {
  CamelCasePlugin,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
} from 'kysely';
import { SearchService } from './search.service';

function buildService() {
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  const spaceMemberRepo = {
    getUserSpaceIdsQuery: jest.fn(() => db.selectFrom('spaces').select('id')),
    getUserSpaceIds: jest.fn().mockResolvedValue([]),
  };
  const pageRepo = { withSpace: () => sql`null`.as('space') };
  const pagePermissionRepo = {
    filterAccessiblePageIds: jest.fn().mockResolvedValue([]),
  };
  const shareRepo = { findById: jest.fn() };
  const service = new SearchService(
    db as any,
    pageRepo as any,
    shareRepo as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
  );
  return { service, spaceMemberRepo };
}

describe('SearchService archived spaces', () => {
  it('leaves archived spaces out of search without a space filter', async () => {
    const { service, spaceMemberRepo } = buildService();

    await service.searchPage({ query: 'roadmap' } as any, {
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    expect(spaceMemberRepo.getUserSpaceIdsQuery).toHaveBeenCalledWith(
      'user-1',
      { excludeArchived: true },
    );
  });

  it('searches archived spaces too when includeArchived is set', async () => {
    const { service, spaceMemberRepo } = buildService();

    await service.searchPage(
      { query: 'roadmap', includeArchived: true } as any,
      { userId: 'user-1', workspaceId: 'ws-1' },
    );

    expect(spaceMemberRepo.getUserSpaceIdsQuery).toHaveBeenCalledWith(
      'user-1',
      { excludeArchived: false },
    );
  });

  it('searches an archived space when the search is scoped to it', async () => {
    const { service, spaceMemberRepo } = buildService();

    await service.searchPage({ query: 'roadmap', spaceId: 'space-1' } as any, {
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    expect(spaceMemberRepo.getUserSpaceIdsQuery).not.toHaveBeenCalled();
  });

  it('keeps the current space in suggestions even when archived', async () => {
    const { service, spaceMemberRepo } = buildService();

    await service.searchSuggestions(
      { query: 'road', includePages: true, spaceId: 'space-1' } as any,
      'user-1',
      'ws-1',
    );

    expect(spaceMemberRepo.getUserSpaceIds).toHaveBeenCalledWith('user-1', {
      excludeArchived: true,
      keepArchivedSpaceId: 'space-1',
    });
  });
});
