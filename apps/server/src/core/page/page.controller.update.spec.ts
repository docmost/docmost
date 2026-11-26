import { NotFoundException } from '@nestjs/common';
import { PageController } from './page.controller';
import { UpdatePageDto } from './dto/update-page.dto';

const PAGE_ID = '019a1f00-0000-7000-8000-000000000011';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000012';
const USER_ID = '019a1f00-0000-7000-8000-000000000013';

describe('PageController update', () => {
  function makeController(page: Record<string, unknown>) {
    const pageService = {
      update: jest.fn(async () => ({ ...page, title: 'Renamed' })),
    };
    const pageRepo = {
      findById: jest.fn(async () => page),
    };
    const pageAccessService = {
      validateCanEdit: jest.fn(async () => ({ hasRestriction: false })),
    };

    const controller = new PageController(
      pageService as any,
      pageRepo as any,
      {} as any,
      {} as any,
      pageAccessService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { controller, pageService };
  }

  const dto = { pageId: PAGE_ID, title: 'Renamed' } as UpdatePageDto;
  const user = { id: USER_ID } as any;

  it('updates a page', async () => {
    const page = { id: PAGE_ID, spaceId: SPACE_ID, deletedAt: null };
    const { controller, pageService } = makeController(page);

    const result = await controller.update(dto, user);

    expect(pageService.update).toHaveBeenCalledWith(page, dto, user);
    expect(result).toStrictEqual({
      ...page,
      title: 'Renamed',
      permissions: { canEdit: true, hasRestriction: false },
    });
  });

  it('treats a page in trash as not found', async () => {
    const page = { id: PAGE_ID, spaceId: SPACE_ID, deletedAt: new Date() };
    const { controller, pageService } = makeController(page);

    await expect(controller.update(dto, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pageService.update).not.toHaveBeenCalled();
  });
});
