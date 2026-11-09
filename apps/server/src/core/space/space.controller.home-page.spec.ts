import { ForbiddenException } from '@nestjs/common';
import { SpaceController } from './space.controller';

const SPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const USER_ID = '019a1f00-0000-7000-8000-000000000004';
const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000005';

const user = { id: USER_ID } as any;
const workspace = { id: WORKSPACE_ID } as any;
const homePage = { id: PAGE_ID, slugId: 'welcome01', title: 'Welcome' };

describe('SpaceController home page', () => {
  function makeController(canAccess = true) {
    const space = { id: SPACE_ID, homePageId: PAGE_ID };
    const spaceService = {
      updateSpace: jest.fn(async () => space),
      getSpaceInfo: jest.fn(async () => space),
      getHomePage: jest.fn(async () => homePage),
    };
    const spaceMemberRepo = { getUserSpaceRoles: jest.fn(async () => []) };
    const spaceAbility = {
      createForUser: jest.fn(async () => ({
        cannot: () => false,
        rules: [],
      })),
    };
    const pagePermissionRepo = {
      canUserAccessPage: jest.fn(async () => canAccess),
    };

    const controller = new SpaceController(
      spaceService as any,
      {} as any,
      spaceMemberRepo as any,
      spaceAbility as any,
      {} as any,
      {} as any,
      pagePermissionRepo as any,
    );

    return { controller, spaceService, space, pagePermissionRepo };
  }

  it('rejects a home page the caller cannot access', async () => {
    const { controller, spaceService } = makeController(false);

    await expect(
      controller.updateSpace(
        { spaceId: SPACE_ID, homePageId: PAGE_ID } as any,
        user,
        workspace,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(spaceService.updateSpace).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', {}],
    ['null', { homePageId: null }],
  ])('skips the page access check when homePageId is %s', async (_name, extra) => {
    const { controller, spaceService, pagePermissionRepo } = makeController();

    await controller.updateSpace(
      { spaceId: SPACE_ID, name: 'Renamed', ...extra } as any,
      user,
      workspace,
    );

    expect(pagePermissionRepo.canUserAccessPage).not.toHaveBeenCalled();
    expect(spaceService.updateSpace).toHaveBeenCalled();
  });

  it('returns the resolved home page with the updated space', async () => {
    const { controller, spaceService, space } = makeController();

    const result = await controller.updateSpace(
      { spaceId: SPACE_ID, homePageId: PAGE_ID } as any,
      user,
      workspace,
    );

    expect(spaceService.getHomePage).toHaveBeenCalledWith(space, USER_ID);
    expect(result).toEqual({ ...space, homePage });
  });

  it('returns the resolved home page with the space info', async () => {
    const { controller, spaceService, space } = makeController();

    const result = await controller.getSpaceInfo(
      { spaceId: SPACE_ID } as any,
      user,
      workspace,
    );

    expect(spaceService.getHomePage).toHaveBeenCalledWith(space, USER_ID);
    expect(result).toEqual(
      expect.objectContaining({ ...space, homePage, membership: expect.any(Object) }),
    );
  });
});
