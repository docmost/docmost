import { ForbiddenException } from '@nestjs/common';
import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
} from 'kysely';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

function buildService(rows: any[] = []) {
  const queries: CompiledQuery[] = [];
  const connection = {
    executeQuery: async (compiled: CompiledQuery) => {
      queries.push(compiled);
      return { rows };
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
  return { service, queries };
}

describe('SearchService verified only', () => {
  it('limits results to verified and approved pages when verifiedOnly is set', async () => {
    const { service, queries } = buildService();

    await service.searchPage({ query: 'roadmap', verifiedOnly: true } as any, {
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    const pagesQuery = queries.find((q) => q.sql.includes('from "pages"'));
    expect(pagesQuery.sql).toContain('exists (select');
    expect(pagesQuery.sql).toContain('"page_verifications"');
    expect(pagesQuery.parameters).toEqual(
      expect.arrayContaining(['qms', 'approved']),
    );
  });

  it('lists verified pages without a query, newest first', async () => {
    const { service, queries } = buildService();

    await service.searchPage({ query: '', verifiedOnly: true } as any, {
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    const pagesQuery = queries.find((q) => q.sql.includes('from "pages"'));
    expect(pagesQuery).toBeDefined();
    expect(pagesQuery.sql).toContain('order by "updated_at" desc');
    expect(pagesQuery.sql).not.toContain('"tsv"');
  });

  it('leaves verification out of the query by default', async () => {
    const { service, queries } = buildService();

    await service.searchPage({ query: 'roadmap' } as any, {
      userId: 'user-1',
      workspaceId: 'ws-1',
    });

    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q.sql).not.toContain('page_verifications');
    }
  });
});

describe('SearchService verification status', () => {
  it('tags results with their verification status', async () => {
    const { service, queries } = buildService([
      {
        pageId: 'a',
        type: 'qms',
        status: 'approved',
        expiresAt: null,
        invalidatedAt: null,
      },
      {
        pageId: 'b',
        type: 'expiring',
        status: null,
        expiresAt: new Date('2000-01-01T00:00:00Z'),
        invalidatedAt: null,
      },
    ]);

    const result = await service.withVerificationStatus([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"page_verifications"');
    expect(queries[0].sql).toContain('"page_id" in');
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    );
    expect(result[0]).toMatchObject({ id: 'a', verificationStatus: 'approved' });
    expect(result[1]).toMatchObject({ id: 'b', verificationStatus: 'expired' });
    expect(result[2]).toEqual({ id: 'c' });
  });
});

describe('SearchController verified only', () => {
  const workspace = { id: 'ws-1', licenseKey: 'key', plan: 'business' } as any;
  const user = { id: 'user-1' } as any;

  function buildController(hasFeature: boolean) {
    const searchService = {
      searchPage: jest.fn().mockResolvedValue({ items: [{ id: 'page-1' }] }),
      withVerificationStatus: jest
        .fn()
        .mockResolvedValue([{ id: 'page-1', verificationStatus: 'verified' }]),
    };
    const spaceAbility = { createForUser: jest.fn() };
    const environmentService = {
      getSearchDriver: jest.fn().mockReturnValue('database'),
    };
    const publicSpaceService = {
      getPublicSpace: jest.fn().mockResolvedValue({ space: { id: 'space-1' } }),
    };
    const pageRepo = {
      getSpacePagesExcludingRestricted: jest
        .fn()
        .mockResolvedValue([{ id: 'page-1' }]),
    };
    const shareService = { isSharingAllowed: jest.fn().mockResolvedValue(true) };
    const shareRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'share-1', spaceId: 'space-1' }),
    };
    const licenseCheckService = {
      hasFeature: jest.fn().mockReturnValue(hasFeature),
    };
    const controller = new SearchController(
      searchService as any,
      spaceAbility as any,
      environmentService as any,
      publicSpaceService as any,
      pageRepo as any,
      shareService as any,
      shareRepo as any,
      {} as any,
      licenseCheckService as any,
    );
    return { controller, searchService, licenseCheckService, environmentService };
  }

  it('refuses verifiedOnly when the workspace lacks page verification', async () => {
    const { controller, searchService } = buildController(false);

    await expect(
      controller.pageSearch(
        { query: 'x', verifiedOnly: true } as any,
        user,
        workspace,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(searchService.searchPage).not.toHaveBeenCalled();
  });

  it('searches verified pages when the workspace has page verification', async () => {
    const { controller, searchService, licenseCheckService } =
      buildController(true);

    await controller.pageSearch(
      { query: 'x', verifiedOnly: true } as any,
      user,
      workspace,
    );

    expect(licenseCheckService.hasFeature).toHaveBeenCalledWith(
      'key',
      'page:verification',
      'business',
    );
    expect(searchService.searchPage).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedOnly: true }),
      expect.anything(),
    );
  });

  it('drops verifiedOnly on share search', async () => {
    const { controller, searchService, licenseCheckService } =
      buildController(true);

    await controller.searchShare(
      { query: 'x', shareId: 'share-1', verifiedOnly: true } as any,
      workspace,
    );

    const params = searchService.searchPage.mock.calls[0][0];
    expect(params).not.toHaveProperty('verifiedOnly');
    expect(licenseCheckService.hasFeature).not.toHaveBeenCalled();
    expect(searchService.withVerificationStatus).not.toHaveBeenCalled();
  });

  it('drops verifiedOnly on public space search', async () => {
    const { controller, searchService, licenseCheckService } =
      buildController(true);

    await controller.searchPublicSpace(
      { query: 'x', spaceSlug: 'docs', verifiedOnly: true } as any,
      workspace,
    );

    const params = searchService.searchPage.mock.calls[0][0];
    expect(params).not.toHaveProperty('verifiedOnly');
    expect(licenseCheckService.hasFeature).not.toHaveBeenCalled();
    expect(searchService.withVerificationStatus).not.toHaveBeenCalled();
  });

  it('adds verification status to results when the workspace has page verification', async () => {
    const { controller, searchService } = buildController(true);

    const result = await controller.pageSearch(
      { query: 'x' } as any,
      user,
      workspace,
    );

    expect(searchService.withVerificationStatus).toHaveBeenCalledWith([
      { id: 'page-1' },
    ]);
    expect(result).toEqual({
      items: [{ id: 'page-1', verificationStatus: 'verified' }],
    });
  });

  it('adds verification status to Typesense results', async () => {
    const { controller, searchService, environmentService } =
      buildController(true);
    environmentService.getSearchDriver.mockReturnValue('typesense');
    jest
      .spyOn(controller, 'searchTypesense' as any)
      .mockResolvedValue({ items: [{ id: 'page-1' }] } as any);

    const result = await controller.pageSearch(
      { query: 'x' } as any,
      user,
      workspace,
    );

    expect(searchService.withVerificationStatus).toHaveBeenCalledWith([
      { id: 'page-1' },
    ]);
    expect(result).toEqual({
      items: [{ id: 'page-1', verificationStatus: 'verified' }],
    });
  });

  it('leaves results untagged without page verification', async () => {
    const { controller, searchService } = buildController(false);

    const result = await controller.pageSearch(
      { query: 'x' } as any,
      user,
      workspace,
    );

    expect(searchService.withVerificationStatus).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [{ id: 'page-1' }] });
  });
});
