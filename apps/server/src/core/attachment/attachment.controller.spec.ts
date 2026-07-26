import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttachmentType } from './attachment.constants';
import { AttachmentController } from './attachment.controller';

describe('AttachmentController removeAttachment', () => {
  const attachment = {
    id: '019f9f01-95c0-75f5-8838-0c1781512e4b',
    fileName: 'diagram.png',
    type: AttachmentType.File,
    pageId: 'page-1',
    spaceId: 'space-1',
    workspaceId: 'workspace-1',
    deletedAt: null,
  };
  const page = { id: 'page-1', spaceId: 'space-1' };
  const attachmentService = {
    scheduleOrphanDeletion: jest.fn(),
  };
  const pageRepo = {
    findById: jest.fn(),
  };
  const attachmentRepo = {
    findById: jest.fn(),
  };
  const pageAccessService = {
    validateCanEdit: jest.fn(),
  };
  const collaborationGateway = {
    handleYjsEvent: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  const controller = new AttachmentController(
    attachmentService as never,
    {} as never,
    {} as never,
    {} as never,
    pageRepo as never,
    attachmentRepo as never,
    {} as never,
    {} as never,
    pageAccessService as never,
    collaborationGateway as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    attachmentRepo.findById.mockResolvedValue(attachment);
    pageRepo.findById.mockResolvedValue(page);
    pageAccessService.validateCanEdit.mockResolvedValue(undefined);
    collaborationGateway.handleYjsEvent.mockResolvedValue(1);
    attachmentService.scheduleOrphanDeletion.mockResolvedValue({
      ...attachment,
      deletedAt: new Date(),
    });
  });

  it('detaches through collaboration before scheduling deletion', async () => {
    const result = await controller.removeAttachment(
      { attachmentId: attachment.id },
      { id: 'workspace-1', trashRetentionDays: 7 } as never,
      { id: 'user-1' } as never,
    );

    expect(pageAccessService.validateCanEdit).toHaveBeenCalledWith(
      page,
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(collaborationGateway.handleYjsEvent).toHaveBeenCalledWith(
      'removeAttachment',
      'page.page-1',
      expect.objectContaining({ attachmentId: attachment.id }),
    );
    expect(
      collaborationGateway.handleYjsEvent.mock.invocationCallOrder[0],
    ).toBeLessThan(
      attachmentService.scheduleOrphanDeletion.mock.invocationCallOrder[0],
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: attachment.id,
        detached: true,
        scheduledForDeletion: true,
        retentionDays: 7,
      }),
    );
    expect(auditService.log).toHaveBeenCalled();
  });

  it('does not disclose attachments from another workspace', async () => {
    await expect(
      controller.removeAttachment(
        { attachmentId: attachment.id },
        { id: 'another-workspace' } as never,
        { id: 'user-1' } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(pageAccessService.validateCanEdit).not.toHaveBeenCalled();
    expect(collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
  });

  it('does not detach when the user cannot edit the owning page', async () => {
    pageAccessService.validateCanEdit.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      controller.removeAttachment(
        { attachmentId: attachment.id },
        { id: 'workspace-1' } as never,
        { id: 'user-1' } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(collaborationGateway.handleYjsEvent).not.toHaveBeenCalled();
    expect(attachmentService.scheduleOrphanDeletion).not.toHaveBeenCalled();
  });
});
