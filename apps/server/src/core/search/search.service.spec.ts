import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('SearchService titles-only search scoping', () => {
  const MEMBER_SPACES_QUERY = Symbol('memberSpacesQuery');

  type PageRow = {
    id: string;
    title: string;
    spaceId: string;
    workspaceId: string;
    deletedAt: Date | null;
  };

  const pages: PageRow[] = [
    { id: 'p1', title: 'Roadmap Q1', spaceId: 'space-1', workspaceId: 'ws1', deletedAt: null },
    { id: 'p2', title: 'Roadmap Q2', spaceId: 'space-2', workspaceId: 'ws1', deletedAt: null },
    { id: 'p3', title: 'Secret roadmap', spaceId: 'other-space', workspaceId: 'ws1', deletedAt: null },
    { id: 'p4', title: 'Foreign roadmap', spaceId: 'foreign-space', workspaceId: 'ws2', deletedAt: null },
  ];

  function makeService(memberSpaceIds: string[]) {
    const wheres: [string, string, unknown][] = [];
    const matches = (row: PageRow, [column, op, value]: [string, string, unknown]) => {
      if (op === 'in') {
        const ids = value === MEMBER_SPACES_QUERY ? memberSpaceIds : (value as string[]);
        return ids.includes(row[column]);
      }
      if (op === 'ilike') {
        return row[column].toLowerCase().includes(String(value).replace(/%/g, '').toLowerCase());
      }
      return row[column] === value;
    };
    const qb: any = {
      select: () => qb,
      orderBy: () => qb,
      limit: () => qb,
      offset: () => qb,
      where: (column: string, op: string, value: unknown) => {
        wheres.push([column, op, value]);
        return qb;
      },
      execute: async () => pages.filter((row) => wheres.every((w) => matches(row, w))),
    };
    const db = { selectFrom: jest.fn(() => qb) };
    const spaceMemberRepo = {
      getUserSpaceIdsQuery: jest.fn(() => MEMBER_SPACES_QUERY),
    };
    const pagePermissionRepo = {
      filterAccessiblePageIds: jest.fn(async ({ pageIds }) => pageIds),
    };
    const service = new SearchService(
      db as any,
      { withSpace: jest.fn() } as any,
      {} as any,
      spaceMemberRepo as any,
      pagePermissionRepo as any,
    );
    return { service, db, wheres, spaceMemberRepo, pagePermissionRepo };
  }

  const ids = (result: { items: any[] }) => result.items.map((item) => item.id);

  it.each(['other-space', 'foreign-space'])(
    'returns nothing for a spaceId the user is not a member of (%s)',
    async (spaceId) => {
      const { service, wheres, spaceMemberRepo } = makeService(['space-1', 'space-2']);

      const result = await service.searchPage(
        { query: 'roadmap', spaceId } as any,
        { userId: 'u1', workspaceId: 'ws1', titlesOnly: true },
      );

      expect(result.items).toEqual([]);
      expect(spaceMemberRepo.getUserSpaceIdsQuery).toHaveBeenCalledWith('u1');
      expect(wheres).toEqual(
        expect.arrayContaining([
          ['spaceId', 'in', MEMBER_SPACES_QUERY],
          ['workspaceId', '=', 'ws1'],
          ['spaceId', '=', spaceId],
        ]),
      );
    },
  );

  it('returns pages from a member spaceId only', async () => {
    const { service, pagePermissionRepo } = makeService(['space-1', 'space-2']);

    const result = await service.searchPage(
      { query: 'roadmap', spaceId: 'space-1' } as any,
      { userId: 'u1', workspaceId: 'ws1', titlesOnly: true },
    );

    expect(ids(result)).toEqual(['p1']);
    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['p1'],
      userId: 'u1',
      spaceId: 'space-1',
    });
  });

  it('returns nothing without a userId even when a spaceId is given', async () => {
    const { service, db } = makeService(['space-1']);

    const result = await service.searchPage(
      { query: 'roadmap', spaceId: 'space-1' } as any,
      { workspaceId: 'ws1', titlesOnly: true },
    );

    expect(result.items).toEqual([]);
    expect(db.selectFrom).not.toHaveBeenCalled();
  });

  it('searches all member spaces in the workspace when no spaceId is given', async () => {
    const { service, wheres, pagePermissionRepo } = makeService(['space-1', 'space-2']);

    const result = await service.searchPage(
      { query: 'roadmap' } as any,
      { userId: 'u1', workspaceId: 'ws1', titlesOnly: true },
    );

    expect(ids(result)).toEqual(['p1', 'p2']);
    expect(wheres).not.toContainEqual(['spaceId', '=', expect.anything()]);
    expect(pagePermissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['p1', 'p2'],
      userId: 'u1',
      spaceId: undefined,
    });
  });
});
