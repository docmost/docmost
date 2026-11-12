import { AttachmentService } from './attachment.service';
import { prepareFile } from '../attachment.utils';
import { streamMultipartFile } from '../../../common/helpers';

jest.mock('../attachment.utils', () => ({
  ...jest.requireActual('../attachment.utils'),
  prepareFile: jest.fn(),
}));

jest.mock('../../../common/helpers', () => ({
  ...jest.requireActual('../../../common/helpers'),
  streamMultipartFile: jest.fn(),
}));

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';

const attachment = (id: string, fileName = 'report.pdf') =>
  ({
    id,
    fileName,
    fileExt: `.${fileName.split('.').pop()}`,
    filePath: `${WORKSPACE_ID}/files/${id}/${fileName}`,
    pageId: PAGE_ID,
    workspaceId: WORKSPACE_ID,
  }) as any;

function makeService(opts: { preservedIds?: string[]; rows?: any[] } = {}) {
  const calls: string[] = [];
  const rows = opts.rows ?? [];
  const storageService = {
    delete: jest.fn(async (path: string) => {
      calls.push(`delete file ${path}`);
    }),
  };
  const attachmentRepo = {
    findById: jest.fn(async (id: string) => rows.find((r) => r.id === id)),
    findBySpaceId: jest.fn(async () => rows),
    findByAiChatId: jest.fn(async () => rows),
    deleteAttachmentById: jest.fn(async (id: string) => {
      calls.push(`delete row ${id}`);
    }),
    updateAttachment: jest.fn(async () => rows[0]),
  };
  const db = {
    selectFrom: jest.fn(() => ({
      select: () => ({ where: () => ({ execute: async () => rows }) }),
    })),
  };
  const legalHoldService = {
    preserveAttachments: jest.fn(async () => {
      calls.push('preserve');
      return opts.preservedIds ?? [];
    }),
    findPreservedAttachmentIds: jest.fn(
      async () => new Set(opts.preservedIds ?? []),
    ),
  };

  const service = new AttachmentService(
    storageService as any,
    attachmentRepo as any,
    {} as any,
    {} as any,
    {} as any,
    db as any,
    { add: jest.fn() } as any,
    {} as any,
    legalHoldService as any,
  );

  return { service, calls, storageService, attachmentRepo, legalHoldService };
}

describe('AttachmentService legal hold preservation', () => {
  describe('deleteAttachment', () => {
    it('keeps the file of a preserved attachment and still deletes its row', async () => {
      const held = attachment('a-1');
      const { service, calls, legalHoldService } = makeService({
        preservedIds: ['a-1'],
      });

      await service.deleteAttachment(held, 'user-1');

      expect(legalHoldService.preserveAttachments).toHaveBeenCalledWith(
        [held],
        'deleted',
        { workspaceId: WORKSPACE_ID, actorId: 'user-1' },
      );
      expect(calls).toEqual(['preserve', 'delete row a-1']);
    });

    it('deletes the file and row of an attachment that is not held', async () => {
      const free = attachment('a-1');
      const { service, calls } = makeService();

      await service.deleteAttachment(free);

      expect(calls).toEqual([
        'preserve',
        `delete file ${free.filePath}`,
        'delete row a-1',
      ]);
    });

    it('deletes nothing when preservation fails', async () => {
      const { service, legalHoldService, storageService, attachmentRepo } =
        makeService();
      legalHoldService.preserveAttachments.mockRejectedValueOnce(
        new Error('db down'),
      );

      await expect(service.deleteAttachment(attachment('a-1'))).rejects.toThrow(
        'db down',
      );

      expect(storageService.delete).not.toHaveBeenCalled();
      expect(attachmentRepo.deleteAttachmentById).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['page', (s: AttachmentService) => s.handleDeletePageAttachments(PAGE_ID)],
    ['space', (s: AttachmentService) => s.handleDeleteSpaceAttachments('space-1')],
    ['AI chat', (s: AttachmentService) => s.handleDeleteAiChatAttachments('chat-1')],
  ])('the %s attachment job', (_label, run) => {
    it('keeps preserved files, deletes the rest and every row, with one lookup', async () => {
      const held = attachment('a-1');
      const free = attachment('a-2', 'notes.txt');
      const { service, calls, legalHoldService } = makeService({
        preservedIds: ['a-1'],
        rows: [held, free],
      });

      await run(service);

      expect(legalHoldService.findPreservedAttachmentIds).toHaveBeenCalledTimes(1);
      expect(legalHoldService.findPreservedAttachmentIds).toHaveBeenCalledWith([
        'a-1',
        'a-2',
      ]);
      expect(calls).not.toContain(`delete file ${held.filePath}`);
      expect(calls).toContain(`delete file ${free.filePath}`);
      expect(calls).toContain('delete row a-1');
      expect(calls).toContain('delete row a-2');
    });
  });

  describe('uploadFile overwriting a diagram', () => {
    const existing = attachment('a-1', 'diagram.drawio.svg');

    beforeEach(() => {
      (prepareFile as jest.Mock).mockResolvedValue({
        fileName: existing.fileName,
        fileExtension: existing.fileExt,
        mimeType: 'image/svg+xml',
        multiPartFile: { file: {} },
      });
    });

    afterEach(() => jest.clearAllMocks());

    it('preserves the current file before streaming the new one', async () => {
      const { service, calls, legalHoldService } = makeService({
        rows: [existing],
      });
      (streamMultipartFile as jest.Mock).mockImplementation(async () => {
        calls.push('upload');
        return 42;
      });

      await service.uploadFile({
        filePromise: Promise.resolve({} as any),
        pageId: PAGE_ID,
        userId: 'user-1',
        spaceId: 'space-1',
        workspaceId: WORKSPACE_ID,
        attachmentId: 'a-1',
      });

      expect(legalHoldService.preserveAttachments).toHaveBeenCalledWith(
        [existing],
        'edited',
        { workspaceId: WORKSPACE_ID, actorId: 'user-1' },
      );
      expect(calls).toEqual(['preserve', 'upload']);
    });

    it('does not overwrite the file when preservation fails', async () => {
      const { service, legalHoldService } = makeService({ rows: [existing] });
      legalHoldService.preserveAttachments.mockRejectedValueOnce(
        new Error('db down'),
      );

      await expect(
        service.uploadFile({
          filePromise: Promise.resolve({} as any),
          pageId: PAGE_ID,
          userId: 'user-1',
          spaceId: 'space-1',
          workspaceId: WORKSPACE_ID,
          attachmentId: 'a-1',
        }),
      ).rejects.toThrow('db down');

      expect(streamMultipartFile).not.toHaveBeenCalled();
    });
  });
});
