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
  const shareService = { isShareReadable: jest.fn().mockResolvedValue(true) };
  const service = new SearchService(
    db as any,
    pageRepo as any,
    shareRepo as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    shareService as any,
  );
  return { service, spaceMemberRepo, shareRepo, shareService };
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

  it('returns nothing from share search when the share is not readable', async () => {
    const { service, shareRepo, shareService } = buildService();
    shareRepo.findById.mockResolvedValue({
      id: 'share-1',
      workspaceId: 'ws-1',
      spaceId: 'space-1',
    });
    shareService.isShareReadable.mockResolvedValue(false);

    await expect(
      service.searchPage({ query: 'roadmap', shareId: 'share-1' } as any, {
        workspaceId: 'ws-1',
      }),
    ).resolves.toEqual({ items: [] });

    expect(shareService.isShareReadable).toHaveBeenCalledWith(
      'ws-1',
      'space-1',
    );
  });
});
