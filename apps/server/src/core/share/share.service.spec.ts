import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';

const WORKSPACE_ID = 'ws-1';
const PAGE = {
  id: '01a14cce-0000-7000-8000-0000000000f1',
  slugId: 'slug1',
  spaceId: 'space-1',
  workspaceId: WORKSPACE_ID,
  title: 'Shared',
  deletedAt: null,
} as any;
const SHARE = {
  id: 'share-1',
  key: 'abc',
  pageId: PAGE.id,
  spaceId: 'space-1',
  workspaceId: WORKSPACE_ID,
  includeSubPages: true,
} as any;

function makeService(
  opts: {
    unpublished?: string[];
    listed?: { id: string; pageId: string; spaceId: string }[];
    controlledSpaces?: string[];
    hiddenFromUser?: string[];
  } = {},
) {
  const unpublished = new Set(opts.unpublished ?? []);
  const shareRepo = {
    findById: jest.fn(async () => ({ ...SHARE })),
    findByPageId: jest.fn(async () => undefined),
    insertShare: jest.fn(async (share: any) => ({ id: 'share-new', ...share })),
    getShares: jest.fn(async () => ({
      items: opts.listed ?? [],
      meta: { hasNextPage: false, nextCursor: null },
    })),
  };
  const pageApprovalService = {
    isHiddenFromUser: jest.fn(async (_userId: string, page: { id: string }) =>
      (opts.hiddenFromUser ?? []).includes(page.id),
    ),
  };
  const pageRepo = {
    findById: jest.fn(async () => ({ ...PAGE })),
    getPageAndDescendantsExcludingRestricted: jest.fn(async () => [{ ...PAGE }]),
  };
  const pagePermissionRepo = {
    hasRestrictedAncestor: jest.fn(async () => false),
    hasUnpublishedAncestor: jest.fn(async (pageId: string) =>
      unpublished.has(pageId),
    ),
    hasControlledPagesInSpace: jest.fn(async (spaceId: string) =>
      (opts.controlledSpaces ?? []).includes(spaceId),
    ),
  };
  const transclusionService = {
    lookupWithAccessSet: jest.fn(
      async (_references: unknown, _accessible: Set<string>) => ({ items: [] }),
    ),
  };

  const service = new ShareService(
    shareRepo as any,
    pageRepo as any,
    pagePermissionRepo as any,
    {} as any,
    {} as any,
    transclusionService as any,
    pageApprovalService as any,
  );
  jest.spyOn(service, 'getShareForPage').mockResolvedValue({ ...SHARE } as any);
  jest.spyOn(service, 'isSharingAllowed').mockResolvedValue(true);

  return {
    service,
    shareRepo,
    pageRepo,
    pagePermissionRepo,
    transclusionService,
    pageApprovalService,
  };
}

describe('ShareService with unpublished approval pages', () => {
  it('getSharedPage 404s for a page with an unpublished ancestor-or-self', async () => {
    const { service, pagePermissionRepo } = makeService({
      unpublished: [PAGE.id],
    });

    await expect(
      service.getSharedPage({ pageId: PAGE.id } as any, WORKSPACE_ID, {
        includeContent: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pagePermissionRepo.hasUnpublishedAncestor).toHaveBeenCalledWith(
      PAGE.id,
    );
  });

  it('getSharedPage still serves a published page', async () => {
    const { service } = makeService();

    const result = await service.getSharedPage(
      { pageId: PAGE.id } as any,
      WORKSPACE_ID,
      { includeContent: false },
    );

    expect(result.page.id).toBe(PAGE.id);
  });

  it('getShareTree 404s when the shared page is unpublished and builds no tree', async () => {
    const { service, pageRepo } = makeService({ unpublished: [PAGE.id] });

    await expect(
      service.getShareTree(SHARE.id, WORKSPACE_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      pageRepo.getPageAndDescendantsExcludingRestricted,
    ).not.toHaveBeenCalled();
  });

  it('getShareInfo returns the share of a published page', async () => {
    const { service, shareRepo } = makeService();

    expect(await service.getShareInfo(SHARE.id)).toMatchObject({
      id: SHARE.id,
    });
    expect(shareRepo.findById).toHaveBeenCalledWith(SHARE.id, {
      includeSharedPage: true,
    });
  });

  it('getShareInfo 404s for a missing share and for an unpublished page', async () => {
    const missing = makeService();
    missing.shareRepo.findById.mockResolvedValue(undefined);
    await expect(missing.service.getShareInfo('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const { service } = makeService({ unpublished: [PAGE.id] });
    await expect(service.getShareInfo(SHARE.id)).rejects.toMatchObject({
      message: 'Share not found',
    });
  });

  it('lookupTransclusionForShare treats unpublished source pages as inaccessible', async () => {
    const { service, transclusionService } = makeService({
      unpublished: ['src-unpublished'],
    });
    const references = [
      { sourcePageId: 'src-published', transclusionId: 't1' },
      { sourcePageId: 'src-unpublished', transclusionId: 't2' },
    ];

    await service.lookupTransclusionForShare(
      SHARE.id,
      references,
      WORKSPACE_ID,
    );

    const accessible = transclusionService.lookupWithAccessSet.mock
      .calls[0][1] as Set<string>;
    expect([...accessible]).toEqual(['src-published']);
  });

  it('createShare refuses an unpublished page before touching shares', async () => {
    const { service, shareRepo } = makeService({ unpublished: [PAGE.id] });

    const result = service.createShare({
      authUserId: 'user-1',
      workspaceId: WORKSPACE_ID,
      page: PAGE,
      createShareDto: { pageId: PAGE.id } as any,
    });

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({
      message: 'Cannot share an unpublished page',
    });
    expect(shareRepo.findByPageId).not.toHaveBeenCalled();
    expect(shareRepo.insertShare).not.toHaveBeenCalled();
  });

  it('getSharesForUser drops shares of pages the user cannot see because of approval', async () => {
    const { service, shareRepo, pagePermissionRepo, pageApprovalService } =
      makeService({
        listed: [
          { id: 's1', pageId: 'p_hidden', spaceId: 'space-controlled' },
          { id: 's2', pageId: 'p_visible', spaceId: 'space-controlled' },
          { id: 's3', pageId: 'p_open', spaceId: 'space-open' },
        ],
        controlledSpaces: ['space-controlled'],
        hiddenFromUser: ['p_hidden', 'p_open'],
      });
    const pagination = { limit: 20 } as any;

    const result = await service.getSharesForUser('user-1', pagination);

    expect(shareRepo.getShares).toHaveBeenCalledWith('user-1', pagination);
    expect(result.items.map((share: any) => share.id)).toEqual(['s2', 's3']);
    expect(result.meta).toEqual({ hasNextPage: false, nextCursor: null });
    expect(pagePermissionRepo.hasControlledPagesInSpace).toHaveBeenCalledTimes(2);
    expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledTimes(2);
    expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledWith('user-1', {
      id: 'p_hidden',
      spaceId: 'space-controlled',
      isBase: false,
    });
  });

  it('createShare still shares a published page', async () => {
    const { service, shareRepo } = makeService();

    await service.createShare({
      authUserId: 'user-1',
      workspaceId: WORKSPACE_ID,
      page: PAGE,
      createShareDto: { pageId: PAGE.id } as any,
    });

    expect(shareRepo.insertShare).toHaveBeenCalled();
  });
});
