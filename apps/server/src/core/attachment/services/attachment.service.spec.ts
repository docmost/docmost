import { Attachment } from '@docmost/db/types/entity.types';
import { Readable } from 'stream';
import { AttachmentType } from '../attachment.constants';
import { AttachmentService } from './attachment.service';

const attachment = (overrides: Partial<Attachment> = {}): Attachment =>
  ({
    id: '019f9f01-95c0-75f5-8838-0c1781512e4b',
    fileName: 'diagram.png',
    filePath: 'workspace/files/attachment/diagram.png',
    fileSize: 10,
    fileExt: '.png',
    mimeType: 'image/png',
    type: AttachmentType.File,
    creatorId: 'user-1',
    pageId: 'page-1',
    spaceId: 'space-1',
    aiChatId: null,
    workspaceId: 'workspace-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as Attachment;

describe('AttachmentService orphan lifecycle', () => {
  const storageService = {
    delete: jest.fn(),
    upload: jest.fn(),
  };
  const attachmentRepo = {
    findById: jest.fn(),
    updateAttachment: jest.fn(),
    deleteAttachmentById: jest.fn(),
    isReferencedByPageContent: jest.fn(),
  };
  const db = {};
  const service = new AttachmentService(
    storageService as never,
    attachmentRepo as never,
    {} as never,
    {} as never,
    {} as never,
    db as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces bytes at the existing storage path to preserve the URL', async () => {
    const existing = attachment({
      fileName: 'original.png',
      filePath: 'workspace-1/files/attachment-id/original.png',
      deletedAt: new Date(),
    });
    const updated = attachment({
      fileName: existing.fileName,
      filePath: existing.filePath,
    });
    attachmentRepo.findById.mockResolvedValue(existing);
    attachmentRepo.updateAttachment.mockResolvedValue(updated);
    storageService.upload.mockImplementation(
      async (_path: string, content: Readable) => {
        for await (const _chunk of content) {
          // Consume the stream as a storage driver would.
        }
      },
    );

    const result = await service.uploadFile({
      filePromise: Promise.resolve({
        filename: 'renamed.png',
        file: Readable.from(Buffer.from('replacement')),
      } as never),
      pageId: existing.pageId,
      spaceId: existing.spaceId,
      userId: existing.creatorId,
      workspaceId: existing.workspaceId,
      attachmentId: existing.id,
    });

    expect(storageService.upload).toHaveBeenCalledWith(
      existing.filePath,
      expect.any(Readable),
    );
    expect(attachmentRepo.updateAttachment).toHaveBeenLastCalledWith(
      expect.objectContaining({ deletedAt: null, fileSize: 11 }),
      existing.id,
    );
    expect(result.fileName).toBe('original.png');
    expect(result.filePath).toBe(existing.filePath);
  });

  it('marks a detached attachment once without extending its retention', async () => {
    const original = attachment();
    const scheduled = attachment({ deletedAt: new Date() });
    attachmentRepo.updateAttachment.mockResolvedValue(scheduled);

    await expect(service.scheduleOrphanDeletion(original)).resolves.toBe(
      scheduled,
    );
    expect(attachmentRepo.updateAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
      original.id,
    );

    await expect(service.scheduleOrphanDeletion(scheduled)).resolves.toBe(
      scheduled,
    );
    expect(attachmentRepo.updateAttachment).toHaveBeenCalledTimes(1);
  });

  it('cancels deletion when an attachment is referenced again', async () => {
    const scheduled = attachment({ deletedAt: new Date() });
    attachmentRepo.findById.mockResolvedValue(scheduled);
    attachmentRepo.isReferencedByPageContent.mockResolvedValue(true);

    await expect(service.purgeOrphanAttachment(scheduled.id)).resolves.toBe(
      false,
    );

    expect(attachmentRepo.updateAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: null }),
      scheduled.id,
    );
    expect(storageService.delete).not.toHaveBeenCalled();
    expect(attachmentRepo.deleteAttachmentById).not.toHaveBeenCalled();
  });

  it('deletes unreferenced attachment storage and metadata', async () => {
    const scheduled = attachment({ deletedAt: new Date() });
    attachmentRepo.findById.mockResolvedValue(scheduled);
    attachmentRepo.isReferencedByPageContent.mockResolvedValue(false);

    await expect(service.purgeOrphanAttachment(scheduled.id)).resolves.toBe(
      true,
    );

    expect(storageService.delete).toHaveBeenCalledWith(scheduled.filePath);
    expect(attachmentRepo.deleteAttachmentById).toHaveBeenCalledWith(
      scheduled.id,
    );
  });

  it('does not delete when the orphan marker changes during cleanup', async () => {
    const scheduled = attachment({ deletedAt: new Date() });
    const restored = attachment({
      deletedAt: null,
      updatedAt: new Date(scheduled.updatedAt.getTime() + 1),
    });
    attachmentRepo.findById
      .mockResolvedValueOnce(scheduled)
      .mockResolvedValueOnce(restored);
    attachmentRepo.isReferencedByPageContent.mockResolvedValue(false);

    await expect(service.purgeOrphanAttachment(scheduled.id)).resolves.toBe(
      false,
    );

    expect(storageService.delete).not.toHaveBeenCalled();
    expect(attachmentRepo.deleteAttachmentById).not.toHaveBeenCalled();
  });
});
