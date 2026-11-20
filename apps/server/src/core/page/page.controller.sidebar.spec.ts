import { PageController } from './page.controller';
import { SidebarPageDto } from './dto/sidebar-page.dto';

const SPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const PARENT_ID = '019a1f00-0000-7000-8000-000000000002';
const USER_ID = '019a1f00-0000-7000-8000-000000000003';
const PARENT_SLUG = 'parentSlug';

const parentPage = {
  id: PARENT_ID,
  slugId: PARENT_SLUG,
  spaceId: SPACE_ID,
};

describe('PageController getSidebarPages', () => {
  function makeController() {
    const pageService = {
      getSidebarPages: jest.fn(async () => ({ items: [] })),
    };
    const pageRepo = {
      findById: jest.fn(async (pageId: string) =>
        [parentPage].find(
          (page) => page.id === pageId || page.slugId === pageId,
        ),
      ),
    };
    const spaceAbility = {
      createForUser: jest.fn(async () => ({
        cannot: () => false,
        can: () => true,
      })),
    };

    const controller = new PageController(
      pageService as any,
      pageRepo as any,
      {} as any,
      spaceAbility as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { controller, pageService };
  }

  it('lists children by page id when given a slug', async () => {
    const { controller, pageService } = makeController();
    const pagination = { limit: 50 };

    await controller.getSidebarPages(
      { pageId: PARENT_SLUG } as SidebarPageDto,
      pagination as any,
      { id: USER_ID } as any,
    );

    expect(pageService.getSidebarPages).toHaveBeenCalledWith(
      SPACE_ID,
      pagination,
      PARENT_ID,
      USER_ID,
      true,
    );
  });
});
