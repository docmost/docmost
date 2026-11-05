import { NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';

function buildService() {
  const shareRepo = { findById: jest.fn() };
  const pageRepo = {
    findById: jest.fn(),
    getPageAndDescendantsExcludingRestricted: jest.fn(),
  };
  const pagePermissionRepo = { hasRestrictedAncestor: jest.fn() };
  const service = new ShareService(
    shareRepo as any,
    pageRepo as any,
    pagePermissionRepo as any,
    {} as any,
    {} as any,
    {} as any,
  );
  jest.spyOn(service, 'isShareReadable').mockResolvedValue(false);
  return { service, shareRepo, pageRepo, pagePermissionRepo };
}

describe('ShareService readability gate', () => {
  it('rejects a shared page before loading it', async () => {
    const { service, pageRepo } = buildService();
    jest.spyOn(service, 'getShareForPage').mockResolvedValue({
      id: 'share-1',
      spaceId: 'space-1',
    } as any);

    await expect(
      service.getSharedPage({ pageId: 'page-1' } as any, 'ws-1'),
    ).rejects.toThrow(NotFoundException);

    expect(service.isShareReadable).toHaveBeenCalledWith('ws-1', 'space-1');
    expect(pageRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects a share tree before the restriction check and descendants query', async () => {
    const { service, shareRepo, pageRepo, pagePermissionRepo } = buildService();
    shareRepo.findById.mockResolvedValue({
      id: 'share-1',
      pageId: 'page-1',
      spaceId: 'space-1',
      workspaceId: 'ws-1',
      includeSubPages: true,
    });

    await expect(service.getShareTree('share-1', 'ws-1')).rejects.toThrow(
      NotFoundException,
    );

    expect(service.isShareReadable).toHaveBeenCalledWith('ws-1', 'space-1');
    expect(pagePermissionRepo.hasRestrictedAncestor).not.toHaveBeenCalled();
    expect(
      pageRepo.getPageAndDescendantsExcludingRestricted,
    ).not.toHaveBeenCalled();
  });
});
