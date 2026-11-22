import { ForbiddenException } from '@nestjs/common';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { FileTaskController } from './file-task.controller';

jest.mock('@docmost/db/pagination/cursor-pagination', () => ({
  executeWithCursorPagination: jest.fn(),
}));

const user = { id: '019a0000-0000-7000-8000-000000000003' } as any;
const workspace = { id: '019a0000-0000-7000-8000-000000000004' } as any;
const openPageId = '019a0000-0000-7000-8000-000000000010';
const restrictedPageId = '019a0000-0000-7000-8000-000000000011';

function makeController(fileTask?: Record<string, unknown>) {
  const qb: any = {
    selectAll: () => qb,
    where: () => qb,
    executeTakeFirst: async () => fileTask,
  };
  const ability = { cannot: () => false };
  const pagePermissionRepo = {
    filterAccessiblePageIds: jest.fn(async () => [openPageId]),
    canUserAccessPage: jest.fn(async () => false),
  };
  const controller = new FileTaskController(
    { createForUser: async () => ability } as any,
    { createForUser: () => ability } as any,
    { getUserSpaceIdsQuery: () => [] } as any,
    pagePermissionRepo as any,
    { selectFrom: () => qb } as any,
  );
  return { controller, pagePermissionRepo };
}

describe('FileTaskController', () => {
  it('returns ZIP warnings to the uploader and only status and ordinary metadata to another space member', async () => {
    const task = {
      id: 'zip',
      spaceId: 'space',
      source: 'confluence',
      creatorId: user.id,
      metadata: { warnings: ['Private import details'], flag: true },
      status: 'success',
    };
    const { controller } = makeController(task);
    await expect(
      controller.getFileTask({ fileTaskId: 'zip' }, user),
    ).resolves.toMatchObject(task);
    const member = { ...user, id: 'another-member' };
    const otherView = await controller.getFileTask(
      { fileTaskId: 'zip' },
      member,
    );
    expect(otherView.metadata).toEqual({ flag: true });
    expect(otherView.status).toEqual('success');
    jest
      .mocked(executeWithCursorPagination)
      .mockResolvedValue({ items: [task], meta: {} } as any);
    const list = await controller.getFileTasks({} as any, member, workspace);
    expect(list.items[0].metadata).toEqual({ flag: true });
    expect(task.metadata.warnings).toEqual(['Private import details']);
  });

  it('leaves out tasks for pages the user cannot open', async () => {
    const { controller } = makeController();
    const tasks = [
      { id: 't3', pageId: restrictedPageId },
      { id: 't2', pageId: openPageId },
      { id: 't1', pageId: null },
    ];
    jest.mocked(executeWithCursorPagination).mockResolvedValue({
      items: tasks,
      meta: { hasNextPage: false },
    } as any);

    const result = await controller.getFileTasks({} as any, user, workspace);

    expect(result.items.map((task) => task.id)).toEqual(['t2', 't1']);
  });

  it('refuses a task tied to a page the user cannot open', async () => {
    const { controller, pagePermissionRepo } = makeController({
      id: 't3',
      spaceId: '019a0000-0000-7000-8000-000000000020',
      pageId: restrictedPageId,
    });

    await expect(
      controller.getFileTask({ fileTaskId: 't3' } as any, user),
    ).rejects.toThrow(ForbiddenException);
    expect(pagePermissionRepo.canUserAccessPage).toHaveBeenCalledWith(
      user.id,
      restrictedPageId,
    );
  });
});
