import { Test } from '@nestjs/testing';
import { BacklinkService } from './backlink.service';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

describe('BacklinkService.countByPageId', () => {
  let service: BacklinkService;
  let backlinkRepo: jest.Mocked<BacklinkRepo>;
  let permissionRepo: jest.Mocked<PagePermissionRepo>;

  const pageId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  beforeEach(async () => {
    const backlinkRepoMock: jest.Mocked<Partial<BacklinkRepo>> = {
      findRelatedPageIds: jest.fn(),
      findPagesByIdsPaginated: jest.fn(),
    };
    const permissionRepoMock: jest.Mocked<Partial<PagePermissionRepo>> = {
      filterAccessiblePageIds: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BacklinkService,
        { provide: BacklinkRepo, useValue: backlinkRepoMock },
        { provide: PagePermissionRepo, useValue: permissionRepoMock },
      ],
    }).compile();

    service = module.get(BacklinkService);
    backlinkRepo = module.get(BacklinkRepo) as jest.Mocked<BacklinkRepo>;
    permissionRepo = module.get(
      PagePermissionRepo,
    ) as jest.Mocked<PagePermissionRepo>;
  });

  it('returns post-filter counts for both directions', async () => {
    backlinkRepo.findRelatedPageIds.mockImplementation(async (_id, dir) =>
      dir === 'incoming' ? ['a', 'b', 'c'] : ['x', 'y'],
    );
    permissionRepo.filterAccessiblePageIds.mockImplementation(
      async ({ pageIds }) =>
        pageIds.filter((id) => id !== 'b' && id !== 'y'),
    );

    const result = await service.countByPageId(pageId, userId);

    expect(result).toEqual({ incoming: 2, outgoing: 1 });
    expect(permissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['a', 'b', 'c'],
      userId,
    });
    expect(permissionRepo.filterAccessiblePageIds).toHaveBeenCalledWith({
      pageIds: ['x', 'y'],
      userId,
    });
  });

  it('skips the permission filter when there are no candidates', async () => {
    backlinkRepo.findRelatedPageIds.mockResolvedValue([]);
    permissionRepo.filterAccessiblePageIds.mockResolvedValue([]);

    const result = await service.countByPageId(pageId, userId);

    expect(result).toEqual({ incoming: 0, outgoing: 0 });
    expect(permissionRepo.filterAccessiblePageIds).not.toHaveBeenCalled();
  });

  it('passes the userId to findRelatedPageIds so the repo can apply space membership filtering', async () => {
    backlinkRepo.findRelatedPageIds.mockResolvedValue([]);

    await service.countByPageId(pageId, userId);

    expect(backlinkRepo.findRelatedPageIds).toHaveBeenCalledWith(
      pageId,
      'incoming',
      userId,
    );
    expect(backlinkRepo.findRelatedPageIds).toHaveBeenCalledWith(
      pageId,
      'outgoing',
      userId,
    );
  });
});

describe('BacklinkService.findByPageId', () => {
  let service: BacklinkService;
  let backlinkRepo: jest.Mocked<BacklinkRepo>;
  let permissionRepo: jest.Mocked<PagePermissionRepo>;

  const pageId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  beforeEach(async () => {
    const backlinkRepoMock: jest.Mocked<Partial<BacklinkRepo>> = {
      findRelatedPageIds: jest.fn(),
      findPagesByIdsPaginated: jest.fn(),
    };
    const permissionRepoMock: jest.Mocked<Partial<PagePermissionRepo>> = {
      filterAccessiblePageIds: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BacklinkService,
        { provide: BacklinkRepo, useValue: backlinkRepoMock },
        { provide: PagePermissionRepo, useValue: permissionRepoMock },
      ],
    }).compile();

    service = module.get(BacklinkService);
    backlinkRepo = module.get(BacklinkRepo) as jest.Mocked<BacklinkRepo>;
    permissionRepo = module.get(
      PagePermissionRepo,
    ) as jest.Mocked<PagePermissionRepo>;
  });

  it('passes filtered ids through to the paginated repo call', async () => {
    backlinkRepo.findRelatedPageIds.mockResolvedValue(['a', 'b']);
    permissionRepo.filterAccessiblePageIds.mockResolvedValue(['a']);
    backlinkRepo.findPagesByIdsPaginated.mockResolvedValue({
      items: [],
      meta: {
        limit: 20,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
    } as any);

    await service.findByPageId(pageId, 'incoming', userId, { limit: 20 } as any);

    expect(backlinkRepo.findPagesByIdsPaginated).toHaveBeenCalledWith(
      ['a'],
      expect.objectContaining({ limit: 20 }),
    );
  });

  it('hands an empty list to the repo when there are no accessible ids', async () => {
    backlinkRepo.findRelatedPageIds.mockResolvedValue([]);
    backlinkRepo.findPagesByIdsPaginated.mockResolvedValue({
      items: [],
      meta: {
        limit: 20,
        hasNextPage: false,
        hasPrevPage: false,
        nextCursor: null,
        prevCursor: null,
      },
    } as any);

    await service.findByPageId(pageId, 'incoming', userId, { limit: 20 } as any);

    expect(backlinkRepo.findPagesByIdsPaginated).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ limit: 20 }),
    );
    expect(permissionRepo.filterAccessiblePageIds).not.toHaveBeenCalled();
  });
});
