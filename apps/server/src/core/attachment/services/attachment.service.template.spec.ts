import { BadRequestException } from '@nestjs/common';
import { AttachmentService } from './attachment.service';

let preparedExt = '.png';
jest.mock('../attachment.utils', () => ({
  ...jest.requireActual('../attachment.utils'),
  prepareFile: async () => ({
    fileName: `a${preparedExt}`,
    fileExtension: preparedExt,
    mimeType: 'x/y',
    fileSize: 0,
    multiPartFile: {},
  }),
}));
jest.mock('../../../common/helpers', () => ({
  ...jest.requireActual('../../../common/helpers'),
  streamMultipartFile: jest.fn(async (_file, upload) => {
    await upload('stream');
    return 42;
  }),
}));

const WORKSPACE_ID = 'ws';
const OLD_ID = 'old-1';
const NEW_ID = 'new-1';

const source = (id: string, ext: string, extra = {}) => ({
  id,
  type: 'file',
  filePath: `${WORKSPACE_ID}/files/${id}/a${ext}`,
  fileName: `a${ext}`,
  fileSize: 10,
  mimeType: 'x/y',
  fileExt: ext,
  creatorId: 'creator-1',
  workspaceId: WORKSPACE_ID,
  pageId: null,
  templateId: 'tpl-1',
  ...extra,
});

describe('AttachmentService template files', () => {
  const storage = { copy: jest.fn(), delete: jest.fn(), upload: jest.fn() };
  const repo = {
    findById: jest.fn(),
    findByTemplateId: jest.fn(),
    insertAttachment: jest.fn(),
    updateAttachment: jest.fn(),
    deleteAttachmentById: jest.fn(),
  };
  const queue = { add: jest.fn() };
  let service: AttachmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    preparedExt = '.png';
    for (const fn of [storage.copy, storage.delete, storage.upload, queue.add])
      fn.mockReset();
    for (const fn of Object.values(repo)) fn.mockReset();
    storage.copy.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    storage.upload.mockResolvedValue(undefined);
    repo.insertAttachment.mockImplementation(async (row) => row);
    repo.updateAttachment.mockImplementation(async (row, id) => ({
      ...row,
      id,
      fileExt: preparedExt,
    }));
    service = new AttachmentService(
      storage as any,
      repo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      queue as any,
      {} as any,
    );
  });

  describe('copyAttachmentsToPage', () => {
    const page = { id: 'page-1', spaceId: 'space-1' };

    it('copies the file, inserts a page row and queues indexing for pdf only', async () => {
      const png = source(OLD_ID, '.png');
      const pdf = source('old-2', '.PDF');
      const idMap = new Map([
        [OLD_ID, NEW_ID],
        ['old-2', 'new-2'],
      ]);

      await service.copyAttachmentsToPage(
        [png, pdf] as any,
        idMap,
        page,
        'user-9',
      );

      expect(storage.copy).toHaveBeenCalledWith(
        `ws/files/${OLD_ID}/a.png`,
        `ws/files/${NEW_ID}/a.png`,
      );
      expect(repo.insertAttachment).toHaveBeenCalledWith({
        id: NEW_ID,
        type: 'file',
        filePath: `ws/files/${NEW_ID}/a.png`,
        fileName: 'a.png',
        fileSize: 10,
        mimeType: 'x/y',
        fileExt: '.png',
        creatorId: 'user-9',
        workspaceId: WORKSPACE_ID,
        pageId: 'page-1',
        spaceId: 'space-1',
      });
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'attachment-index-content',
        { attachmentId: 'new-2' },
        expect.objectContaining({ attempts: 2 }),
      );
    });

    it('continues with the next file when a copy fails', async () => {
      storage.copy.mockRejectedValueOnce(new Error('boom'));
      const idMap = new Map([
        [OLD_ID, NEW_ID],
        ['old-2', 'new-2'],
      ]);

      await service.copyAttachmentsToPage(
        [source(OLD_ID, '.png'), source('old-2', '.png')] as any,
        idMap,
        page,
        'user-9',
      );

      expect(storage.copy).toHaveBeenCalledTimes(2);
      expect(repo.insertAttachment).toHaveBeenCalledTimes(1);
      expect(repo.insertAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-2' }),
      );
    });

    it('skips files without a mapped id', async () => {
      await service.copyAttachmentsToPage(
        [source(OLD_ID, '.png')] as any,
        new Map(),
        page,
        'user-9',
      );

      expect(storage.copy).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteTemplateAttachments', () => {
    it('deletes every file and row, surviving a storage failure', async () => {
      repo.findByTemplateId.mockResolvedValue([
        source('a1', '.png'),
        source('a2', '.png'),
      ]);
      storage.delete.mockRejectedValueOnce(new Error('boom'));

      await service.handleDeleteTemplateAttachments('tpl-1');

      expect(repo.findByTemplateId).toHaveBeenCalledWith('tpl-1');
      expect(storage.delete).toHaveBeenCalledTimes(2);
      expect(repo.deleteAttachmentById).toHaveBeenCalledTimes(1);
      expect(repo.deleteAttachmentById).toHaveBeenCalledWith('a2');
    });
  });

  describe('uploadFile owner check', () => {
    const upload = (opts: object) =>
      service.uploadFile({
        filePromise: Promise.resolve({} as any),
        spaceId: 'space-1',
        userId: 'user-1',
        workspaceId: WORKSPACE_ID,
        attachmentId: OLD_ID,
        ...opts,
      });

    it('refuses to overwrite a file owned by another template', async () => {
      repo.findById.mockResolvedValue(
        source(OLD_ID, '.png', { templateId: 'tpl-1' }),
      );

      await expect(upload({ templateId: 'tpl-2' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('refuses to overwrite a page file from a template', async () => {
      repo.findById.mockResolvedValue(
        source(OLD_ID, '.png', { templateId: null, pageId: 'page-1' }),
      );

      await expect(upload({ templateId: 'tpl-1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('refuses to overwrite a template file from a page', async () => {
      repo.findById.mockResolvedValue(source(OLD_ID, '.png'));

      await expect(upload({ pageId: 'page-1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates the row when the owner matches', async () => {
      repo.findById.mockResolvedValue(source(OLD_ID, '.png'));

      await upload({ templateId: 'tpl-1' });

      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(repo.updateAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ fileSize: 42 }),
        OLD_ID,
      );
      expect(repo.insertAttachment).not.toHaveBeenCalled();
    });

    it('stores new rows with the template and does not queue indexing', async () => {
      preparedExt = '.pdf';
      repo.findById.mockResolvedValue(null);
      const result = await service.uploadFile({
        filePromise: Promise.resolve({} as any),
        spaceId: 'space-1',
        userId: 'user-1',
        workspaceId: WORKSPACE_ID,
        templateId: 'tpl-1',
      });

      expect(repo.insertAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'tpl-1' }),
        undefined,
      );
      expect(result.fileExt).toBe('.pdf');
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
