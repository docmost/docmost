import { PageController } from './page.controller';
import { AuditEvent } from '../../common/events/audit-events';

const USER = { id: 'user-1', workspaceId: 'ws-1' } as any;
const PAGE = {
  id: '01a14cce-0000-7000-8000-0000000000f1',
  spaceId: 'space-1',
  workspaceId: 'ws-1',
  title: 'Moved',
  deletedAt: null,
} as any;

function makeController(removedApproverIds: string[]) {
  const pageService = {
    movePageToSpace: jest.fn(async () => ({
      childPageIds: [],
      removedApproverIds,
    })),
  };
  const auditService = { log: jest.fn() };
  const controller = new PageController(
    pageService as any,
    { findById: jest.fn(async () => ({ ...PAGE })) } as any,
    {} as any,
    {
      createForUser: jest.fn(async () => ({ can: () => true, cannot: () => false })),
    } as any,
    { validateCanEdit: jest.fn(async () => ({ hasRestriction: false })) } as any,
    {} as any,
    {} as any,
    auditService as any,
    {} as any,
  );
  return { controller, pageService, auditService };
}

describe('PageController /pages/move-to-space audit', () => {
  it('records page approvers removed by a move into an approval space', async () => {
    const { controller, auditService } = makeController(['approver-1']);

    await controller.movePageToSpace(
      { pageId: PAGE.id, spaceId: 'space-2' } as any,
      USER,
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuditEvent.PAGE_MOVED_TO_SPACE,
        metadata: expect.objectContaining({
          removedApproverIds: ['approver-1'],
        }),
      }),
    );
  });

  it('leaves the audit metadata as before when no approver was removed', async () => {
    const { controller, auditService } = makeController([]);

    await controller.movePageToSpace(
      { pageId: PAGE.id, spaceId: 'space-2' } as any,
      USER,
    );

    expect(auditService.log.mock.calls[0][0].metadata).toEqual({
      title: 'Moved',
    });
  });
});
