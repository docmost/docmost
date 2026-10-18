import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PageController } from './page.controller';

const USER = { id: 'user-1', workspaceId: 'ws-1' } as any;
const WORKSPACE = { id: 'ws-1' } as any;
const PAGE_ID = '01a14cce-0000-7000-8000-0000000000e1';
const PARENT_ID = '01a14cce-0000-7000-8000-0000000000e2';

const PAGE = {
  id: PAGE_ID,
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  parentPageId: null,
  deletedAt: null,
} as any;
const PARENT = { ...PAGE, id: PARENT_ID };

function makeController(parentError: Error) {
  const pageService = {
    create: jest.fn(),
    movePage: jest.fn(),
  };
  const pageRepo = {
    findById: jest.fn(async (id: string) =>
      id === PARENT_ID ? { ...PARENT } : { ...PAGE },
    ),
  };
  const pageAccessService = {
    validateCanEdit: jest.fn(async (page: { id: string }) => {
      if (page.id === PARENT_ID) throw parentError;
      return { hasRestriction: false };
    }),
  };
  const spaceAbility = {
    createForUser: jest.fn(async () => ({
      can: () => true,
      cannot: () => false,
    })),
  };

  const controller = new PageController(
    pageService as any,
    pageRepo as any,
    {} as any,
    spaceAbility as any,
    pageAccessService as any,
    {} as any,
    {} as any,
    { log: jest.fn() } as any,
    {} as any,
  );

  return { controller, pageService };
}

describe('PageController parents hidden by approval', () => {
  it('create answers a hidden parent like a missing one', async () => {
    const { controller, pageService } = makeController(
      new NotFoundException('Page not found'),
    );

    const result = controller.create(
      { spaceId: 'space-1', parentPageId: PARENT_ID } as any,
      USER,
      WORKSPACE,
    );

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({
      message: 'Parent page not found',
    });
    expect(pageService.create).not.toHaveBeenCalled();
  });

  it('create keeps the permission error for a parent the user can see but not edit', async () => {
    const { controller } = makeController(new ForbiddenException());

    await expect(
      controller.create(
        { spaceId: 'space-1', parentPageId: PARENT_ID } as any,
        USER,
        WORKSPACE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('move answers a hidden target parent like a missing one', async () => {
    const { controller, pageService } = makeController(
      new NotFoundException('Page not found'),
    );

    const result = controller.movePage(
      { pageId: PAGE_ID, parentPageId: PARENT_ID, position: 'a1' } as any,
      USER,
    );

    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toMatchObject({
      message: 'Target parent page not found',
    });
    expect(pageService.movePage).not.toHaveBeenCalled();
  });

  it('move keeps the permission error for a target parent the user can see but not edit', async () => {
    const { controller } = makeController(new ForbiddenException());

    await expect(
      controller.movePage(
        { pageId: PAGE_ID, parentPageId: PARENT_ID, position: 'a1' } as any,
        USER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
