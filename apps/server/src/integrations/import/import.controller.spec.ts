import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import * as bytes from 'bytes';
import * as fs from 'fs-extra';
import { FastifyInstance } from 'fastify';
import { ImportController } from './import.controller';
import { ImportService } from './services/import.service';
import { StorageService } from '../storage/storage.service';
import { LocalDriver } from '../storage/drivers/local.driver';
import {
  createMultipartApp,
  MULTIPART_HEADERS,
  MULTIPART_TAIL,
  multipartBody,
  multipartFields,
  multipartHead,
  postInChunks,
} from '../../../test/multipart.helper';

// ESM only, which Jest does not transform here
jest.mock('@sindresorhus/slugify', () => ({ default: (text: string) => text }));

const USER = { id: 'user-id' };
const WORKSPACE = { id: 'workspace-id' };
const SPACE_ID = 'space-id';
const IMPORT_LIMIT = '2mb';
const SMALL_LIMIT = 1024;

describe('ImportController uploads', () => {
  let root: string;
  let app: FastifyInstance;
  let importService: ImportService;

  const importsDir = () => join(root, WORKSPACE.id, 'imports');
  const pageRepo = { insertPage: jest.fn() };
  const fileTaskQueue = { add: jest.fn() };
  const auditService = { log: jest.fn() };
  const insertFileTask = jest.fn();

  // only the two chains the import service runs
  const db = {
    insertInto: () => ({
      values: (row: any) => ({
        returningAll: () => ({
          executeTakeFirst: async () => {
            insertFileTask(row);
            return row;
          },
        }),
      }),
    }),
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              where: () => ({ executeTakeFirst: async () => undefined }),
            }),
          }),
        }),
      }),
    }),
  };

  const post = (
    url: string,
    fileName: string,
    content: Buffer,
    fields: Record<string, string> = {},
  ) =>
    app.inject({
      method: 'POST',
      url,
      headers: MULTIPART_HEADERS,
      payload: multipartBody(fileName, content, {
        spaceId: SPACE_ID,
        ...fields,
      }),
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    pageRepo.insertPage.mockImplementation(async (page) => page);

    root = await fs.mkdtemp(join(tmpdir(), 'import-upload-'));
    importService = new ImportService(
      pageRepo as any,
      new StorageService(new LocalDriver({ storagePath: root })),
      db as any,
      fileTaskQueue as any,
      {} as any,
    );
    const controller = new ImportController(
      importService,
      { createForUser: async () => ({ cannot: () => false }) } as any,
      { getFileImportSizeLimit: () => IMPORT_LIMIT } as any,
      auditService as any,
    );

    app = await createMultipartApp({
      '/pages/import': (req) =>
        controller.importPage(req, USER as any, WORKSPACE as any),
      '/pages/import-zip': (req) =>
        controller.importZip(req, USER as any, WORKSPACE as any),
      // the route's own limit is too large to line a chunk boundary up with it
      '/import-small': (req) =>
        importService.importPage(
          req.file({ limits: { fileSize: SMALL_LIMIT } }),
          USER.id,
          SPACE_ID,
          WORKSPACE.id,
        ),
    });
  });

  afterEach(async () => {
    await app.close();
    await fs.remove(root);
  });

  describe('POST /pages/import', () => {
    const LIMIT = bytes('30mb');

    it('imports a file within the limit', async () => {
      const response = await post(
        '/pages/import',
        'notes.md',
        Buffer.from('# Notes\n\nBody'),
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().title).toBe('Notes');
      expect(pageRepo.insertPage).toHaveBeenCalledTimes(1);
    });

    it('rejects a file over the limit', async () => {
      const response = await post(
        '/pages/import',
        'notes.md',
        Buffer.alloc(LIMIT + 1, 'a'),
      );

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        'File too large. Exceeds the 30mb import limit',
      );
      expect(pageRepo.insertPage).not.toHaveBeenCalled();
    });

    it('reports the 30mb limit when the parser rejects the form', async () => {
      // the plugin only surfaces its fields limit if no file part is waiting
      const payload = new PassThrough();
      payload.write(multipartFields({ a: '1', b: '2', c: '3', d: '4', e: '5' }));

      const response = await app.inject({
        method: 'POST',
        url: '/pages/import',
        headers: MULTIPART_HEADERS,
        payload,
      });
      payload.destroy();

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        'File too large. Exceeds the 30mb import limit',
      );
    });

    it('rejects when a chunk boundary lands exactly on the limit', async () => {
      const response = await postInChunks(app, '/import-small', [
        Buffer.concat([multipartHead('notes.md'), Buffer.alloc(SMALL_LIMIT, 'a')]),
        Buffer.alloc(100, 'b'),
        MULTIPART_TAIL,
      ]);

      expect(response.statusCode).toBe(413);
      expect(pageRepo.insertPage).not.toHaveBeenCalled();
    });
  });

  describe('POST /pages/import-zip', () => {
    it.each([
      ['below', bytes('1mb')],
      ['exactly at', bytes(IMPORT_LIMIT)],
    ])('stores a zip %s the limit', async (_label, size) => {
      const content = randomBytes(size);

      const response = await post('/pages/import-zip', 'export.zip', content, {
        source: 'generic',
      });

      expect(response.statusCode).toBe(200);
      const { filePath, fileSize } = response.json();
      expect(fileSize).toBe(size);
      expect(await fs.readFile(join(root, filePath))).toEqual(content);
      expect(fileTaskQueue.add).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledTimes(1);
    });

    it('rejects a zip over the limit and leaves nothing behind', async () => {
      const response = await post(
        '/pages/import-zip',
        'export.zip',
        randomBytes(bytes('3mb')),
        { source: 'generic' },
      );

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        `File too large. Exceeds the ${IMPORT_LIMIT} import limit`,
      );
      expect(await fs.readdir(importsDir())).toEqual([]);
      expect(insertFileTask).not.toHaveBeenCalled();
      expect(fileTaskQueue.add).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });
});
