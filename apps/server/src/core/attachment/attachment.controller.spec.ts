import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import * as bytes from 'bytes';
import * as fs from 'fs-extra';
import { FastifyInstance } from 'fastify';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BlockBlobClient } from '@azure/storage-blob';
import { AttachmentController } from './attachment.controller';
import { MAX_AVATAR_SIZE } from './attachment.constants';
import { AttachmentService } from './services/attachment.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { LocalDriver } from '../../integrations/storage/drivers/local.driver';
import { S3Driver } from '../../integrations/storage/drivers/s3.driver';
import { AzureDriver } from '../../integrations/storage/drivers/azure.driver';
import { StorageDriver } from '../../integrations/storage/interfaces';
import { streamToBuffer } from '../../integrations/storage/storage.utils';
import {
  createMultipartApp,
  MULTIPART_HEADERS,
  MULTIPART_TAIL,
  multipartBody,
  multipartHead,
  postAndDisconnect,
  postInChunks,
} from '../../../test/multipart.helper';

jest.mock(
  '../../ee/template/services/template-access.service',
  () => ({ TemplateAccessService: class TemplateAccessService {} }),
  { virtual: true },
);

const USER = { id: 'user-id' };
const WORKSPACE = { id: 'workspace-id', hostname: 'docs' };
const PAGE_ID = 'page-id';
const ATTACHMENT_ID = '0195f9d2-7d3e-7b1a-9c3f-1a2b3c4d5e6f';
const DRAWIO = 'diagram.drawio.svg';
const EXCALIDRAW = 'diagram.excalidraw.svg';
const EXISTING_KEY = `${WORKSPACE.id}/files/${ATTACHMENT_ID}/${DRAWIO}`;
const pageDiagram = {
  id: ATTACHMENT_ID,
  pageId: PAGE_ID,
  workspaceId: WORKSPACE.id,
  type: 'file',
  diagramType: 'drawio',
  fileName: DRAWIO,
  fileExt: '.svg',
  filePath: EXISTING_KEY,
};

interface StorageFixture {
  driver: StorageDriver;
  put(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  // everything left under the workspace files folder, unfinished uploads included
  leftovers(): Promise<string[]>;
  cleanup(): Promise<void>;
}

async function createLocalStorage(): Promise<StorageFixture> {
  const root = await fs.mkdtemp(join(tmpdir(), 'attachment-upload-'));
  const driver = new LocalDriver({ storagePath: root });
  const filesDir = join(root, WORKSPACE.id, 'files');

  return {
    driver,
    put: (key, content) => driver.upload(key, content),
    read: (key) => driver.read(key),
    leftovers: async () =>
      (await fs.pathExists(filesDir))
        ? fs.readdir(filesDir, { recursive: true }) as Promise<string[]>
        : [],
    cleanup: () => fs.remove(root),
  };
}

async function createS3Storage(): Promise<StorageFixture> {
  const objects = new Map<string, Buffer>();
  const uploads = new Map<string, Buffer[]>();
  const driver = new S3Driver({
    region: 'us-east-1',
    endpoint: 'https://s3.example.com',
    bucket: 'docmost',
  });

  driver.getDriver().send = (async (command: any) => {
    const { Key, UploadId, PartNumber, Body } = command.input;
    switch (command.constructor.name) {
      case 'PutObjectCommand':
        objects.set(Key, Body);
        return {};
      case 'CreateMultipartUploadCommand':
        uploads.set(Key, []);
        return { UploadId: Key };
      case 'UploadPartCommand':
        uploads.get(UploadId)[PartNumber - 1] = Body;
        return { ETag: `${PartNumber}` };
      case 'CompleteMultipartUploadCommand':
        objects.set(Key, Buffer.concat(uploads.get(UploadId)));
        uploads.delete(UploadId);
        return {};
      case 'AbortMultipartUploadCommand':
        uploads.delete(UploadId);
        return {};
      default:
        throw new Error(`Unexpected ${command.constructor.name}`);
    }
  }) as any;

  return {
    driver,
    put: async (key, content) => void objects.set(key, content),
    read: async (key) => objects.get(key),
    leftovers: async () => [...objects.keys(), ...uploads.keys()],
    cleanup: async () => undefined,
  };
}

async function createAzureStorage(): Promise<StorageFixture> {
  const blobs = new Map<string, Buffer>();
  const blocks = new Map<string, Buffer>();
  const driver = new AzureDriver({
    accountName: 'account',
    accountKey: Buffer.from('key').toString('base64'),
    container: 'docmost',
  });

  jest
    .spyOn(BlockBlobClient.prototype, 'stageBlock')
    .mockImplementation(async (blockId, body: any) => {
      blocks.set(blockId, await streamToBuffer(body()));
      return {} as any;
    });
  jest
    .spyOn(BlockBlobClient.prototype, 'commitBlockList')
    .mockImplementation(async function (this: BlockBlobClient, blockIds) {
      blobs.set(this.name, Buffer.concat(blockIds.map((id) => blocks.get(id))));
      return { _response: { status: 201 } } as any;
    });

  return {
    driver,
    put: async (key, content) => void blobs.set(key, content),
    read: async (key) => blobs.get(key),
    leftovers: async () => [...blobs.keys()],
    cleanup: async () => void jest.restoreAllMocks(),
  };
}

describe.each([
  ['local', createLocalStorage],
  ['s3', createS3Storage],
  ['azure', createAzureStorage],
])('AttachmentController uploads on %s storage', (_name, createStorage) => {
  let storage: StorageFixture;
  let app: FastifyInstance;
  let uploadLimit: string;
  // settles with the error the route ended on, once it finished
  let routeError: Promise<Error | undefined>;
  let markRouteDone: (done: Promise<Error | undefined>) => void;
  let fileReceived: Promise<void>;
  let markFileReceived: () => void;

  const attachmentRepo = {
    findById: jest.fn(),
    insertAttachment: jest.fn(),
    updateAttachment: jest.fn(),
  };
  const draftService = { write: jest.fn(), read: jest.fn(), discard: jest.fn() };
  const attachmentQueue = { add: jest.fn(), remove: jest.fn() };
  const auditService = { log: jest.fn() };
  const templateRepo = { findById: jest.fn() };
  const spaceMemberRepo = { getUserSpaceRoles: jest.fn() };
  const templateAccessService = { findEditableTemplate: jest.fn() };
  const pageAccessService = { validateCanEdit: jest.fn() };
  const moduleRef = { get: jest.fn(() => templateAccessService) };
  let controllerRef: AttachmentController;

  const postFile = (
    fileName: string,
    content: Buffer,
    fields: Record<string, string> = {},
  ) =>
    app.inject({
      method: 'POST',
      url: '/files/upload',
      headers: MULTIPART_HEADERS,
      payload: multipartBody(fileName, content, {
        pageId: PAGE_ID,
        ...fields,
      }),
    });
  const post = (content: Buffer, fields: Record<string, string> = {}) =>
    postFile('diagram.pdf', content, fields);

  beforeEach(async () => {
    jest.clearAllMocks();
    uploadLimit = '2mb';
    routeError = new Promise((resolve) => (markRouteDone = resolve));
    fileReceived = new Promise((resolve) => (markFileReceived = resolve));

    attachmentRepo.findById.mockResolvedValue(pageDiagram);
    attachmentRepo.insertAttachment.mockImplementation(async (row) => row);
    attachmentRepo.updateAttachment.mockImplementation(async (row, id) => ({
      ...(await attachmentRepo.findById(id)),
      ...row,
    }));

    storage = await createStorage();
    const storageService = new StorageService(storage.driver);
    const attachmentService = new AttachmentService(
      storageService,
      attachmentRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      attachmentQueue as any,
      {} as any,
    );
    const controller = new AttachmentController(
      attachmentService,
      storageService,
      {} as any,
      {} as any,
      {
        findById: async () => {
          markFileReceived();
          return { id: PAGE_ID, spaceId: 'space-id', workspaceId: WORKSPACE.id };
        },
      } as any,
      attachmentRepo as any,
      { getFileUploadSizeLimit: () => uploadLimit } as any,
      {} as any,
      pageAccessService as any,
      { getUrl: () => 'https://docs.example.com' } as any,
      auditService as any,
      templateRepo as any,
      spaceMemberRepo as any,
      moduleRef as any,
      draftService as any,
    );
    controllerRef = controller;

    app = await createMultipartApp({
      '/files/upload': (req, res) => {
        const result = controller.uploadFile(
          req,
          res,
          USER as any,
          WORKSPACE as any,
        );
        markRouteDone(
          result.then(
            () => undefined,
            (err) => err,
          ),
        );
        return result;
      },
      '/attachments/upload-image': (req, res) =>
        controller.uploadAvatarOrLogo(
          req,
          res,
          USER as any,
          WORKSPACE as any,
        ),
    });
  });

  afterEach(async () => {
    await app.close();
    await storage.cleanup();
  });

  describe('diagram names', () => {
    const rename = () =>
      controllerRef.renameDiagram(
        { attachmentId: ATTACHMENT_ID, name: 'Network 100% café' },
        USER as any,
        WORKSPACE as any,
      );

    it.each(['drawio', 'excalidraw'])(
      'renames a %s attachment without writing a file',
      async (diagramType) => {
        attachmentRepo.findById.mockResolvedValue({
          ...pageDiagram,
          diagramType,
        });
        const content = Buffer.from('<svg/>');
        await storage.put(EXISTING_KEY, content);
        const keys = await storage.leftovers();
        const renamed = await rename();
        expect(renamed).toMatchObject({
          id: ATTACHMENT_ID,
          filePath: EXISTING_KEY,
          fileName: `Network 100% café.${diagramType}.svg`,
        });
        expect(await storage.leftovers()).toEqual(keys);
        expect(await storage.read(EXISTING_KEY)).toEqual(content);
        expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
        expect(pageAccessService.validateCanEdit).toHaveBeenCalledWith(
          expect.objectContaining({ id: PAGE_ID }),
          USER,
        );
      },
    );

    it.each([{ diagramType: null }, { workspaceId: 'other' }])(
      'rejects an ineligible attachment',
      async (patch) => {
        attachmentRepo.findById.mockResolvedValue({ ...pageDiagram, ...patch });
        await expect(rename()).rejects.toThrow(NotFoundException);
        expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      },
    );

    it('checks edit permission on the owning page or template', async () => {
      pageAccessService.validateCanEdit.mockRejectedValueOnce(
        new ForbiddenException(),
      );
      await expect(rename()).rejects.toThrow(ForbiddenException);
      attachmentRepo.findById.mockResolvedValue({
        ...pageDiagram,
        pageId: null,
        templateId: 'template',
      });
      templateAccessService.findEditableTemplate.mockRejectedValueOnce(
        new ForbiddenException(),
      );
      await expect(rename()).rejects.toThrow(ForbiddenException);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    });
  });

  describe('private diagram drafts', () => {
    const draft = {
      draftId: ATTACHMENT_ID,
      pageId: PAGE_ID,
      type: 'drawio' as const,
    };
    it('autosaves to the authenticated editor’s draft without uploading a page attachment', async () => {
      draftService.write.mockImplementation(async (_key, file) => {
        await file.toBuffer();
      });
      const response = await postFile(DRAWIO, Buffer.from('<svg/>'), draft);
      expect(response.statusCode).toBe(204);
      const key = [
        WORKSPACE.id,
        USER.id,
        'page',
        PAGE_ID,
        'drawio',
        ATTACHMENT_ID,
      ].join('/');
      expect(draftService.write).toHaveBeenCalledWith(key, expect.anything());
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      await controllerRef.discardDiagramDraft(
        draft,
        { id: 'other' } as any,
        WORKSPACE as any,
      );
      expect(draftService.discard).toHaveBeenCalledWith(
        key.replace(USER.id, 'other'),
      );
    });

    it('checks current editing permission before reading or discarding a draft', async () => {
      pageAccessService.validateCanEdit
        .mockRejectedValueOnce(new ForbiddenException())
        .mockRejectedValueOnce(new ForbiddenException());
      await expect(
        controllerRef.readDiagramDraft(
          draft,
          USER as any,
          WORKSPACE as any,
          {} as any,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        controllerRef.discardDiagramDraft(draft, USER as any, WORKSPACE as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(draftService.read).not.toHaveBeenCalled();
      expect(draftService.discard).not.toHaveBeenCalled();
    });
  });

  describe('cover uploads', () => {
    it('stores a cover image as a page cover and queues its cleanup', async () => {
      const content = randomBytes(1024);

      const response = await postFile('team offsite.jpg', content, {
        type: 'page-cover',
      });

      expect(response.statusCode).toBe(200);
      const { id, filePath } = response.json();
      expect(await storage.read(filePath)).toEqual(content);
      expect(attachmentRepo.insertAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ id, type: 'page-cover', pageId: PAGE_ID }),
        undefined,
      );
      expect(attachmentQueue.remove).toHaveBeenCalledWith(`cover-cleanup-${id}`);
      expect(attachmentQueue.add).toHaveBeenCalledWith(
        'delete-unused-cover',
        { pageId: PAGE_ID, attachmentId: id },
        expect.objectContaining({ jobId: `cover-cleanup-${id}`, delay: 3_600_000 }),
      );
    });

    it.each([
      ['not an image', 'notes.pdf'],
      ['a GIF', 'anim.gif'],
    ])('rejects a cover that is %s and says why', async (_label, fileName) => {
      const response = await postFile(fileName, randomBytes(1024), {
        type: 'page-cover',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        'Cover must be a JPG, PNG or WebP image',
      );
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('stores a cover of exactly 5 MB', async () => {
      uploadLimit = '10mb';

      const response = await postFile('cover.jpg', randomBytes(bytes('5mb')), {
        type: 'page-cover',
      });

      expect(response.statusCode).toBe(200);
    });

    it('rejects a cover over 5 MB and leaves nothing behind', async () => {
      uploadLimit = '10mb';

      const response = await postFile(
        'cover.jpg',
        randomBytes(bytes('5mb') + 1),
        { type: 'page-cover' },
      );

      expect(response.statusCode).toBe(413);
      expect(response.json().message).toBe(
        'Cover image must be 5 MB or smaller',
      );
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('refuses to overwrite a template file from a page upload', async () => {
      attachmentRepo.findById.mockResolvedValue({
        ...pageDiagram,
        pageId: null,
        templateId: 'template-id',
      });

      const response = await postFile(DRAWIO, randomBytes(1024), {
        attachmentId: ATTACHMENT_ID,
        type: 'drawio',
      });

      expect(response.statusCode).toBe(400);
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    });

    it('never overwrites an existing attachment with a cover', async () => {
      const response = await postFile('cover.jpg', randomBytes(1024), {
        type: 'page-cover',
        attachmentId: ATTACHMENT_ID,
      });

      expect(response.statusCode).toBe(400);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('rejects any other attachment type', async () => {
      const response = await postFile('cover.jpg', randomBytes(1024), {
        type: 'avatar',
      });

      expect(response.statusCode).toBe(400);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('treats type=file as a plain upload', async () => {
      const response = await post(randomBytes(1024), { type: 'file' });

      expect(response.statusCode).toBe(200);
      expect(attachmentRepo.insertAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'file' }),
        undefined,
      );
    });
  });

  describe('template uploads', () => {
    const TEMPLATE_ID = '0195f9d2-7d3e-7b1a-9c3f-aaaaaaaaaaaa';
    const postTemplateFile = (
      fields: Record<string, string>,
      fileName = 'diagram.pdf',
    ) =>
      app.inject({
        method: 'POST',
        url: '/files/upload',
        headers: MULTIPART_HEADERS,
        payload: multipartBody(fileName, randomBytes(1024), fields),
      });

    beforeEach(() => {
      templateAccessService.findEditableTemplate.mockReset();
    });

    it('stores an upload for a template the user can edit', async () => {
      templateAccessService.findEditableTemplate.mockResolvedValue({
        id: TEMPLATE_ID,
        spaceId: 'space-1',
      });

      const response = await postTemplateFile({ templateId: TEMPLATE_ID });

      expect(response.statusCode).toBe(200);
      expect(templateAccessService.findEditableTemplate).toHaveBeenCalledWith(
        TEMPLATE_ID,
        USER,
        WORKSPACE,
      );
      expect(moduleRef.get).toHaveBeenCalledWith(
        jest.requireMock('../../ee/template/services/template-access.service')
          .TemplateAccessService,
        { strict: false },
      );
      const row = attachmentRepo.insertAttachment.mock.calls[0][0];
      expect(row).toEqual(
        expect.objectContaining({ templateId: TEMPLATE_ID, spaceId: 'space-1' }),
      );
      expect(row.pageId).toBeUndefined();
    });

    it('refuses a template the user cannot edit before storing anything', async () => {
      templateAccessService.findEditableTemplate.mockRejectedValue(
        new ForbiddenException(),
      );

      const response = await postTemplateFile({ templateId: TEMPLATE_ID });

      expect(response.statusCode).toBe(403);
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown template', async () => {
      templateAccessService.findEditableTemplate.mockRejectedValue(
        new NotFoundException('Template not found'),
      );

      const response = await postTemplateFile({ templateId: TEMPLATE_ID });

      expect(response.statusCode).toBe(404);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('rejects an invalid template id', async () => {
      const response = await postTemplateFile({ templateId: 'not-a-uuid' });

      expect(response.statusCode).toBe(400);
      expect(templateAccessService.findEditableTemplate).not.toHaveBeenCalled();
    });

    it('rejects a page and a template in the same upload', async () => {
      const response = await postTemplateFile({
        pageId: PAGE_ID,
        templateId: TEMPLATE_ID,
      });

      expect(response.statusCode).toBe(400);
      expect(templateAccessService.findEditableTemplate).not.toHaveBeenCalled();
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('treats an empty templateId as a page upload', async () => {
      const response = await postTemplateFile({
        pageId: PAGE_ID,
        templateId: '',
      });

      expect(response.statusCode).toBe(200);
      expect(templateAccessService.findEditableTemplate).not.toHaveBeenCalled();
      const row = attachmentRepo.insertAttachment.mock.calls[0][0];
      expect(row.pageId).toBe(PAGE_ID);
      expect(row.templateId).toBeUndefined();
    });

    it('treats an empty pageId as a template upload', async () => {
      templateAccessService.findEditableTemplate.mockResolvedValue({
        id: TEMPLATE_ID,
        spaceId: null,
      });

      const response = await postTemplateFile({
        pageId: '',
        templateId: TEMPLATE_ID,
      });

      expect(response.statusCode).toBe(200);
      const row = attachmentRepo.insertAttachment.mock.calls[0][0];
      expect(row.templateId).toBe(TEMPLATE_ID);
      expect(row.pageId).toBeUndefined();
    });

    it("creates a new revision of the template's own diagram", async () => {
      templateAccessService.findEditableTemplate.mockResolvedValue({
        id: TEMPLATE_ID,
        spaceId: null,
      });
      attachmentRepo.findById.mockResolvedValue({
        id: ATTACHMENT_ID,
        pageId: null,
        templateId: TEMPLATE_ID,
        type: 'file',
        diagramType: 'excalidraw',
        fileName: EXCALIDRAW,
        fileExt: '.svg',
        filePath: `${WORKSPACE.id}/files/${ATTACHMENT_ID}/${EXCALIDRAW}`,
        workspaceId: WORKSPACE.id,
      });

      const response = await postTemplateFile(
        {
          templateId: TEMPLATE_ID,
          previousAttachmentId: ATTACHMENT_ID,
          type: 'excalidraw',
        },
        EXCALIDRAW,
      );

      expect(response.statusCode).toBe(200);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      expect(response.json().id).not.toBe(ATTACHMENT_ID);
      expect(response.json().diagramId).toBe(ATTACHMENT_ID);
    });

    it("refuses to overwrite a page's file from a template upload", async () => {
      templateAccessService.findEditableTemplate.mockResolvedValue({
        id: TEMPLATE_ID,
        spaceId: null,
      });

      const response = await postTemplateFile(
        { templateId: TEMPLATE_ID, attachmentId: ATTACHMENT_ID, type: 'drawio' },
        DRAWIO,
      );

      expect(response.statusCode).toBe(400);
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    });

    it('rejects a cover upload for a template', async () => {
      templateAccessService.findEditableTemplate.mockResolvedValue({
        id: TEMPLATE_ID,
        spaceId: null,
      });

      const response = await postTemplateFile({
        templateId: TEMPLATE_ID,
        type: 'page-cover',
      });

      expect(response.statusCode).toBe(400);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });
  });

  describe('template files', () => {
    const FILE = {
      id: ATTACHMENT_ID,
      templateId: 'template-id',
      pageId: null,
      workspaceId: WORKSPACE.id,
    };
    let sendFileResponse: jest.SpyInstance;

    const read = () =>
      controllerRef.getFile(
        {} as any,
        {} as any,
        USER as any,
        WORKSPACE as any,
        ATTACHMENT_ID,
        'a.png',
      );

    beforeEach(() => {
      attachmentRepo.findById.mockResolvedValue(FILE);
      sendFileResponse = jest
        .spyOn(controllerRef as any, 'sendFileResponse')
        .mockResolvedValue('sent');
    });

    it('streams a global template file', async () => {
      templateRepo.findById.mockResolvedValue({ id: 'template-id' });

      await expect(read()).resolves.toBe('sent');
      expect(templateRepo.findById).toHaveBeenCalledWith(
        'template-id',
        WORKSPACE.id,
      );
      expect(sendFileResponse).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        FILE,
        'private',
      );
    });

    it('streams a space template file to a space member', async () => {
      templateRepo.findById.mockResolvedValue({
        id: 'template-id',
        spaceId: 'space-1',
      });
      spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([
        { userId: USER.id, role: 'reader' },
      ]);

      await expect(read()).resolves.toBe('sent');
      expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledWith(
        USER.id,
        'space-1',
      );
    });

    it('hides a space template file from a non-member', async () => {
      templateRepo.findById.mockResolvedValue({
        id: 'template-id',
        spaceId: 'space-1',
      });
      spaceMemberRepo.getUserSpaceRoles.mockResolvedValue(undefined);

      await expect(read()).rejects.toBeInstanceOf(NotFoundException);
      expect(sendFileResponse).not.toHaveBeenCalled();
    });

    it('answers not found for an unknown template', async () => {
      templateRepo.findById.mockResolvedValue(undefined);

      await expect(read()).rejects.toBeInstanceOf(NotFoundException);
    });

    describe('files/info', () => {
      const info = () =>
        controllerRef.getAttachmentInfo(
          { attachmentId: ATTACHMENT_ID } as any,
          WORKSPACE as any,
          USER as any,
        );
      const unknownIdError = async () => {
        attachmentRepo.findById.mockResolvedValueOnce(undefined);
        return info().catch((err) => err);
      };

      it('returns the stored diagram type independently of the filename', async () => {
        attachmentRepo.findById.mockResolvedValue({
          ...FILE,
          type: 'file',
          fileName: 'workflow.svg',
          diagramType: 'excalidraw',
        });
        templateRepo.findById.mockResolvedValue({ id: FILE.templateId });

        await expect(info()).resolves.toMatchObject({
          fileName: 'workflow.svg',
          diagramType: 'excalidraw',
        });
      });

      it('answers a non-member exactly like an unknown id', async () => {
        const expected = await unknownIdError();
        attachmentRepo.findById.mockResolvedValue({ ...FILE, type: 'file' });
        templateRepo.findById.mockResolvedValue({
          id: 'template-id',
          spaceId: 'space-1',
        });
        spaceMemberRepo.getUserSpaceRoles.mockResolvedValue(undefined);

        const err = await info().catch((e) => e);

        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.getResponse()).toEqual(expected.getResponse());
      });

      it('answers a deleted template exactly like an unknown id', async () => {
        const expected = await unknownIdError();
        attachmentRepo.findById.mockResolvedValue({ ...FILE, type: 'file' });
        templateRepo.findById.mockResolvedValue(undefined);

        const err = await info().catch((e) => e);

        expect(err).toBeInstanceOf(NotFoundException);
        expect(err.getResponse()).toEqual(expected.getResponse());
      });
    });
  });

  describe('new attachments', () => {
    it.each([
      ['below', bytes('1mb')],
      ['exactly at', bytes('2mb')],
    ])('stores a file %s the limit unchanged', async (_label, size) => {
      const content = randomBytes(size);

      const response = await post(content);

      expect(response.statusCode).toBe(200);
      const { id, fileSize, filePath } = response.json();
      expect(fileSize).toBe(size);
      expect(filePath).toBe(`${WORKSPACE.id}/files/${id}/diagram.pdf`);
      expect(await storage.read(filePath)).toEqual(content);
      expect(attachmentRepo.insertAttachment).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['below the S3 part size', '2mb', bytes('3mb')],
      ['one byte over', '2mb', bytes('2mb') + 1],
      ['above the S3 part size', '6mb', bytes('7mb')],
    ])('rejects an over-limit file %s', async (_label, limit, size) => {
      uploadLimit = limit;

      const response = await post(randomBytes(size));

      expect(response.statusCode).toBe(413);
      expect(response.json().message).toBe(
        `File too large. Exceeds the ${limit} limit`,
      );
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
      expect(attachmentQueue.add).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('answers a client that is still sending', async () => {
      const megabyte = randomBytes(bytes('1mb'));

      const response = await postInChunks(app, '/files/upload', [
        multipartHead('diagram.pdf', { pageId: PAGE_ID }),
        ...Array(6).fill(megabyte),
        MULTIPART_TAIL,
      ]);

      expect(response.statusCode).toBe(413);
      expect(JSON.parse(response.body).message).toBe(
        'File too large. Exceeds the 2mb limit',
      );
      expect(await storage.leftovers()).toEqual([]);
    });

    it('leaves nothing behind when the client disconnects', async () => {
      await postAndDisconnect(
        app,
        '/files/upload',
        Buffer.concat([
          multipartHead('diagram.pdf', { pageId: PAGE_ID }),
          randomBytes(1024),
        ]),
        fileReceived,
      );

      expect((await routeError).message).toBe('Error processing file upload.');
      expect(await storage.leftovers()).toEqual([]);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });
  });

  describe('avatar and icon images', () => {
    const postImage = (fileName: string, size: number) =>
      app.inject({
        method: 'POST',
        url: '/attachments/upload-image',
        headers: MULTIPART_HEADERS,
        payload: multipartBody(fileName, Buffer.alloc(size), { type: 'avatar' }),
      });

    it('reports the limit for an image over it', async () => {
      const response = await postImage(
        'avatar.png',
        bytes(MAX_AVATAR_SIZE) + 1,
      );

      expect(response.statusCode).toBe(413);
      expect(response.json().message).toBe(
        `File too large. Exceeds the ${MAX_AVATAR_SIZE} limit`,
      );
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('keeps the generic message for other failures', async () => {
      const response = await postImage('avatar.gif', 1024);

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Error processing file upload.');
    });
  });

  describe('updating an attachment', () => {
    const existing = randomBytes(1024);

    beforeEach(async () => {
      await storage.put(EXISTING_KEY, existing);
    });

    it.each<[string, string, Record<string, string>]>([
      ['report.pdf', 'report.pdf', {}],
      ['logo.svg', 'logo.svg', { type: 'file' }],
      ['logo.svg', DRAWIO, { type: 'drawio' }],
      [DRAWIO, DRAWIO, { type: 'drawio' }],
      ['plan.svg', 'plan.svg', { type: 'drawio' }],
      [EXCALIDRAW, EXCALIDRAW, { type: 'excalidraw' }],
    ])(
      'refuses to overwrite unflagged %s with %s and fields %j',
      async (storedName, incomingName, fields) => {
        const upload = await postFile(storedName, existing);
        expect(upload.statusCode).toBe(200);
        const attachment = upload.json();
        expect(attachment.diagramType).toBeNull();
        attachmentRepo.findById.mockResolvedValue(attachment);

        const replacement = Buffer.from('replacement');
        const response = await postFile(incomingName, replacement, {
          attachmentId: attachment.id,
          ...fields,
        });

        expect(response.statusCode).toBe(400);
        expect(await storage.read(attachment.filePath)).toEqual(existing);
        expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['drawio', DRAWIO],
      ['excalidraw', EXCALIDRAW],
      ['drawio', 'Network-plan.SVG'],
      ['excalidraw', 'Network-plan.SVG'],
      ['drawio', 'Network #1 café.drawio.svg'],
      ['excalidraw', 'Network #1 café.excalidraw.svg'],
    ])(
      'publishes type %s and file %s to a fresh ID and keeps the original bytes',
      async (diagramType, fileName) => {
        const upload = await postFile(fileName, Buffer.from('<svg/>'), {
          type: diagramType,
        });
        expect(upload.statusCode).toBe(200);
        const attachment = upload.json();
        expect(attachment).toMatchObject({ type: 'file', fileName, diagramType });
        attachmentRepo.findById.mockResolvedValue(attachment);

        const content = Buffer.from('<svg><circle r="5"/></svg>');
        const response = await postFile('export.svg', content, {
          previousAttachmentId: attachment.id,
          type: diagramType,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          diagramId: attachment.id,
          diagramType,
          fileName,

        });
        expect(response.json().id).not.toBe(attachment.id);
        expect(await storage.read(response.json().filePath)).toEqual(content);
        expect(await storage.read(attachment.filePath)).toEqual(Buffer.from('<svg/>'));
        expect(attachmentRepo.insertAttachment).toHaveBeenCalledTimes(2);
      },
    );

    it.each([
      ['diagram', DRAWIO],
      ['drawio', 'report.pdf'],
      ['excalidraw', 'scene.html'],
    ])('rejects type %s with filename %s', async (type, fileName) => {
      const response = await postFile(fileName, existing, { type });
      expect(response.statusCode).toBe(400);
      expect(attachmentRepo.insertAttachment).not.toHaveBeenCalled();
    });

    it('publishes a new revision for a backfilled diagram whose importer stored an uppercase extension', async () => {
      attachmentRepo.findById.mockResolvedValue({
        ...pageDiagram,
        fileExt: '.SVG',
      });
      const content = Buffer.from('<svg/>');
      const response = await postFile(DRAWIO, content, {
        previousAttachmentId: ATTACHMENT_ID,
        type: 'drawio',
      });

      expect(response.statusCode).toBe(200);
      expect(await storage.read(EXISTING_KEY)).toEqual(existing);
      expect(await storage.read(response.json().filePath)).toEqual(content);
    });

    it.each<Record<string, string>>([
      {},
      { type: 'file' },
      { type: 'diagram' },
      { type: 'drawio' },
      { type: 'excalidraw' },
    ])(
      'rejects an existing attachment ID on every upload with %j',
      async (fields) => {
        const response = await postFile(DRAWIO, Buffer.from('replacement'), {
          attachmentId: ATTACHMENT_ID,
          ...fields,
        });

        expect(response.statusCode).toBe(400);
        expect(await storage.read(EXISTING_KEY)).toEqual(existing);
        expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      },
    );

    it.each([
      { pageId: 'another-page' },
      { workspaceId: 'another-workspace' },
      { type: 'page-cover' },
      { diagramType: 'excalidraw' },
    ])(
      'rejects a revision for a stored attachment with %j',
      async (other) => {
        attachmentRepo.findById.mockResolvedValue({ ...pageDiagram, ...other });
        const response = await postFile(DRAWIO, randomBytes(1024), {
          previousAttachmentId: ATTACHMENT_ID,
          type: 'drawio',
        });
        expect(response.statusCode).toBe(400);
        expect(await storage.read(EXISTING_KEY)).toEqual(existing);
        expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['below', bytes('1mb')],
      ['exactly at', bytes('2mb')],
    ])('creates a revision %s the limit', async (_label, size) => {
      const content = randomBytes(size);

      const response = await postFile(DRAWIO, content, {
        previousAttachmentId: ATTACHMENT_ID,
        type: 'drawio',
      });

      expect(response.statusCode).toBe(200);
      expect(await storage.read(EXISTING_KEY)).toEqual(existing);
      expect(await storage.read(response.json().filePath)).toEqual(content);
      expect(response.json().fileSize).toBe(size);
    });

    it.each([
      ['below the S3 part size', '2mb', '3mb'],
      ['above the S3 part size', '6mb', '7mb'],
    ])(
      'keeps the existing file when the update is %s',
      async (_label, limit, size) => {
        uploadLimit = limit;

        const response = await postFile(DRAWIO, randomBytes(bytes(size)), {
          previousAttachmentId: ATTACHMENT_ID,
          type: 'drawio',
        });

        expect(response.statusCode).toBe(413);
        expect(response.json().message).toBe(
          `File too large. Exceeds the ${limit} limit`,
        );
        expect(await storage.read(EXISTING_KEY)).toEqual(existing);
        expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
        expect(auditService.log).not.toHaveBeenCalled();
      },
    );

    it('keeps the existing file when the client disconnects', async () => {
      await postAndDisconnect(
        app,
        '/files/upload',
        Buffer.concat([
          multipartHead(DRAWIO, {
            pageId: PAGE_ID,
            previousAttachmentId: ATTACHMENT_ID,
            type: 'drawio',
          }),
          randomBytes(1024),
        ]),
        fileReceived,
      );

      expect(await routeError).toBeInstanceOf(Error);
      expect(await storage.read(EXISTING_KEY)).toEqual(existing);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    });
  });
});
