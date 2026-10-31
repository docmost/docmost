import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import * as bytes from 'bytes';
import * as fs from 'fs-extra';
import { FastifyInstance } from 'fastify';
import { BlockBlobClient } from '@azure/storage-blob';
import { AttachmentController } from './attachment.controller';
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

const USER = { id: 'user-id' };
const WORKSPACE = { id: 'workspace-id', hostname: 'docs' };
const PAGE_ID = 'page-id';
const ATTACHMENT_ID = '0195f9d2-7d3e-7b1a-9c3f-1a2b3c4d5e6f';
const EXISTING_KEY = `${WORKSPACE.id}/files/${ATTACHMENT_ID}/diagram.pdf`;

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
])('POST /files/upload on %s storage', (_name, createStorage) => {
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
  const attachmentQueue = { add: jest.fn() };
  const auditService = { log: jest.fn() };

  const post = (content: Buffer, fields: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/files/upload',
      headers: MULTIPART_HEADERS,
      payload: multipartBody('diagram.pdf', content, {
        pageId: PAGE_ID,
        ...fields,
      }),
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    uploadLimit = '2mb';
    routeError = new Promise((resolve) => (markRouteDone = resolve));
    fileReceived = new Promise((resolve) => (markFileReceived = resolve));

    attachmentRepo.findById.mockResolvedValue({
      id: ATTACHMENT_ID,
      pageId: PAGE_ID,
      fileExt: '.pdf',
      workspaceId: WORKSPACE.id,
    });
    attachmentRepo.insertAttachment.mockImplementation(async (row) => row);
    attachmentRepo.updateAttachment.mockImplementation(async (row, id) => ({
      ...row,
      id,
      fileName: 'diagram.pdf',
      fileExt: '.pdf',
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
    );
    const controller = new AttachmentController(
      attachmentService,
      storageService,
      {} as any,
      {} as any,
      {
        findById: async () => {
          markFileReceived();
          return { id: PAGE_ID, spaceId: 'space-id' };
        },
      } as any,
      attachmentRepo as any,
      { getFileUploadSizeLimit: () => uploadLimit } as any,
      {} as any,
      { validateCanEdit: async () => undefined } as any,
      { getUrl: () => 'https://docs.example.com' } as any,
      auditService as any,
    );

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
    });
  });

  afterEach(async () => {
    await app.close();
    await storage.cleanup();
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

      expect(response.statusCode).toBe(400);
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

      expect(response.statusCode).toBe(400);
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

  describe('updating an attachment', () => {
    const existing = randomBytes(1024);

    beforeEach(async () => {
      await storage.put(EXISTING_KEY, existing);
    });

    it.each([
      ['below', bytes('1mb')],
      ['exactly at', bytes('2mb')],
    ])('replaces the file with one %s the limit', async (_label, size) => {
      const content = randomBytes(size);

      const response = await post(content, { attachmentId: ATTACHMENT_ID });

      expect(response.statusCode).toBe(200);
      expect(await storage.read(EXISTING_KEY)).toEqual(content);
      expect(attachmentRepo.updateAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ fileSize: size }),
        ATTACHMENT_ID,
      );
    });

    it.each([
      ['below the S3 part size', '2mb', '3mb'],
      ['above the S3 part size', '6mb', '7mb'],
    ])(
      'keeps the existing file when the update is %s',
      async (_label, limit, size) => {
        uploadLimit = limit;

        const response = await post(randomBytes(bytes(size)), {
          attachmentId: ATTACHMENT_ID,
        });

        expect(response.statusCode).toBe(400);
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
          multipartHead('diagram.pdf', {
            pageId: PAGE_ID,
            attachmentId: ATTACHMENT_ID,
          }),
          randomBytes(1024),
        ]),
        fileReceived,
      );

      expect((await routeError).message).toBe('Error processing file upload.');
      expect(await storage.read(EXISTING_KEY)).toEqual(existing);
      expect(attachmentRepo.updateAttachment).not.toHaveBeenCalled();
    });
  });
});
