import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UnsplashController } from './unsplash.controller';

describe('UnsplashController', () => {
  const user = { id: 'user-1' } as any;
  const page = { id: 'page-1', spaceId: 'space-1' } as any;
  const photos = { items: [], hasMore: false };

  function setup(opts: { page?: any; canEdit?: boolean } = {}) {
    const unsplashService = { listPhotos: jest.fn().mockResolvedValue(photos) };
    const pageRepo = {
      findById: jest.fn().mockResolvedValue('page' in opts ? opts.page : page),
    };
    const pageAccessService = {
      validateCanEdit: jest.fn(async () => {
        if (opts.canEdit === false) throw new ForbiddenException();
        return { hasRestriction: false };
      }),
    };
    const controller = new UnsplashController(
      unsplashService as any,
      pageRepo as any,
      pageAccessService as any,
    );
    return { controller, unsplashService, pageRepo, pageAccessService };
  }

  it('lists photos for someone who can edit the page', async () => {
    const { controller, unsplashService, pageRepo, pageAccessService } =
      setup();

    await expect(
      controller.listPhotos({ pageId: 'page-1', query: 'sea', page: 2 }, user),
    ).resolves.toBe(photos);
    expect(pageRepo.findById).toHaveBeenCalledWith('page-1');
    expect(pageAccessService.validateCanEdit).toHaveBeenCalledWith(page, user);
    expect(unsplashService.listPhotos).toHaveBeenCalledWith('sea', 2);
  });

  it('refuses someone who cannot edit the page without calling Unsplash', async () => {
    const { controller, unsplashService } = setup({ canEdit: false });

    await expect(
      controller.listPhotos({ pageId: 'page-1' }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(unsplashService.listPhotos).not.toHaveBeenCalled();
  });

  it('refuses a page that does not exist', async () => {
    const { controller, unsplashService } = setup({ page: undefined });

    await expect(
      controller.listPhotos({ pageId: 'missing' }, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(unsplashService.listPhotos).not.toHaveBeenCalled();
  });
});
