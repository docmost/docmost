import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SearchController } from './search.controller';

describe('SearchController', () => {
  let controller: SearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

describe('SearchController public-space-search gate', () => {
  function makeController(overrides: any = {}) {
    const searchService = { searchPage: jest.fn().mockResolvedValue([]) };
    const environmentService = {
      getSearchDriver: jest.fn().mockReturnValue('postgres'),
    };
    const publicSpaceService = {
      getPublicSpace: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Space not found')),
      ...overrides.publicSpaceService,
    };
    const pageRepo = {
      getSpacePagesExcludingRestricted: jest
        .fn()
        .mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]),
    };
    const controller = new SearchController(
      searchService as any,
      {} as any,
      environmentService as any,
      publicSpaceService as any,
      pageRepo as any,
      {} as any,
    );
    return { controller, searchService, publicSpaceService, pageRepo };
  }

  const workspace = { id: 'ws1' } as any;

  it('does not read pages or search when the public space gate rejects', async () => {
    const { controller, searchService, pageRepo } = makeController();
    await expect(
      controller.searchPublicSpace(
        { query: 'roadmap', spaceSlug: 'handbook' } as any,
        workspace,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pageRepo.getSpacePagesExcludingRestricted).not.toHaveBeenCalled();
    expect(searchService.searchPage).not.toHaveBeenCalled();
  });

  it('searches only the unrestricted pages of the gated space, ignoring client filters', async () => {
    const { controller, searchService, publicSpaceService, pageRepo } =
      makeController({
        publicSpaceService: {
          getPublicSpace: jest
            .fn()
            .mockResolvedValue({ space: { id: 's1' }, publicSpace: {} }),
        },
      });
    await controller.searchPublicSpace(
      {
        query: 'roadmap',
        spaceSlug: 'handbook',
        spaceId: 'attacker-space',
        shareId: 'share1',
        creatorId: 'u1',
        labelIds: ['l1'],
      } as any,
      workspace,
    );
    expect(publicSpaceService.getPublicSpace).toHaveBeenCalledWith(
      'handbook',
      workspace,
    );
    expect(pageRepo.getSpacePagesExcludingRestricted).toHaveBeenCalledWith('s1');
    expect(searchService.searchPage).toHaveBeenCalledWith(
      { query: 'roadmap', spaceSlug: 'handbook' },
      { workspaceId: 'ws1', publicPageIds: ['p1', 'p2'] },
    );
  });
});
