import { once } from 'events';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { FastifyInstance } from 'fastify';
import { bufferMultipartFile, streamMultipartFile } from './multipart.utils';
import {
  createMultipartApp,
  MULTIPART_HEADERS,
  MULTIPART_TAIL,
  multipartBody,
  multipartHead,
  postAndDisconnect,
  postInChunks,
} from '../../../test/multipart.helper';

const LIMIT = 1024;

function collect(stream: Readable) {
  const chunks: Buffer[] = [];
  return pipeline(
    stream,
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    }),
  ).then(() => Buffer.concat(chunks));
}

describe('multipart utils', () => {
  let app: FastifyInstance;
  let settled: Promise<unknown>;
  let onFile: (file: any) => Promise<unknown>;
  let fileReceived: Promise<void>;
  let markFileReceived: () => void;

  const post = (size: number) =>
    app.inject({
      method: 'POST',
      url: '/upload',
      headers: MULTIPART_HEADERS,
      payload: multipartBody('a.bin', Buffer.alloc(size, 'a')),
    });

  beforeEach(async () => {
    fileReceived = new Promise((resolve) => (markFileReceived = resolve));
    app = await createMultipartApp({
      '/upload': async (req, res) => {
        const file = await req.file({ limits: { fileSize: LIMIT } });
        settled = onFile(file);
        markFileReceived();
        return res.send({ result: await settled });
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('streamMultipartFile', () => {
    it.each([
      ['below', LIMIT - 1],
      ['exactly at', LIMIT],
    ])('passes a file %s the limit through', async (_label, size) => {
      let received: Buffer;
      onFile = (file) =>
        streamMultipartFile(file, async (stream) => {
          received = await collect(stream);
        });

      const response = await post(size);

      expect(response.json().result).toBe(size);
      expect(received).toEqual(Buffer.alloc(size, 'a'));
    });

    it('fails the stream before it ends for a file over the limit', async () => {
      const ended = jest.fn();
      onFile = (file) =>
        streamMultipartFile(file, async (stream) => {
          stream.on('end', ended);
          await collect(stream);
        });

      const response = await post(LIMIT + 1);

      expect(response.statusCode).toBe(413);
      expect(ended).not.toHaveBeenCalled();
    });

    it('rejects when the limit was hit before reading started', async () => {
      onFile = async (file) => {
        // the lookups before the upload leave busboy parsing on its own
        await new Promise((done) => setTimeout(done, 50));
        expect(file.file.truncated).toBe(true);
        return streamMultipartFile(file, (stream) => collect(stream));
      };

      expect((await post(LIMIT + 1)).statusCode).toBe(413);
    });

    it('reports the size even when the storage driver wraps the error', async () => {
      onFile = (file) =>
        streamMultipartFile(file, async (stream) => {
          await collect(stream).catch(() => {
            throw new Error('Failed to upload file');
          });
        });

      expect((await post(LIMIT + 1)).statusCode).toBe(413);
    });

    it('lets a storage failure through for a file within the limit', async () => {
      onFile = (file) =>
        streamMultipartFile(file, async (stream) => {
          await collect(stream);
          throw new Error('storage is down');
        });

      const response = await post(LIMIT);

      expect(response.statusCode).toBe(500);
      expect(response.json().message).toBe('storage is down');
    });

    it('fails the stream when the client disconnects', async () => {
      let streamFailed: (err: Error) => void;
      const failed = new Promise<Error>((resolve) => (streamFailed = resolve));
      onFile = (file) =>
        streamMultipartFile(file, (stream) =>
          collect(stream).catch((err) => {
            streamFailed(err);
            throw err;
          }),
        );

      await postAndDisconnect(
        app,
        '/upload',
        Buffer.concat([multipartHead('a.bin'), Buffer.alloc(100, 'a')]),
        fileReceived,
      );

      expect((await failed).message).toBe('Premature close');
      await expect(settled).rejects.toThrow('Premature close');
    });

    it('fails the stream when the client left before reading started', async () => {
      let streamFailed: (err: Error) => void;
      const failed = new Promise<Error>((resolve) => (streamFailed = resolve));
      onFile = async (file) => {
        await once(file.file, 'close');
        return streamMultipartFile(file, (stream) =>
          collect(stream).catch(streamFailed),
        );
      };

      await postAndDisconnect(
        app,
        '/upload',
        Buffer.concat([multipartHead('a.bin'), Buffer.alloc(100, 'a')]),
        fileReceived,
      );

      expect((await failed).message).toBe('Premature close');
    });
  });

  describe('bufferMultipartFile', () => {
    it.each([
      ['below', LIMIT - 1],
      ['exactly at', LIMIT],
    ])('returns a file %s the limit', async (_label, size) => {
      let received: Buffer;
      onFile = async (file) => {
        received = await bufferMultipartFile(file);
      };

      await post(size);

      expect(received).toEqual(Buffer.alloc(size, 'a'));
    });

    it('rejects a file over the limit', async () => {
      onFile = (file) => bufferMultipartFile(file);

      expect((await post(LIMIT + 1)).statusCode).toBe(413);
    });

    it('rejects when a chunk boundary lands exactly on the limit', async () => {
      onFile = (file) => bufferMultipartFile(file);

      const response = await postInChunks(app, '/upload', [
        Buffer.concat([multipartHead('a.bin'), Buffer.alloc(LIMIT, 'a')]),
        Buffer.alloc(100, 'b'),
        MULTIPART_TAIL,
      ]);

      expect(response.statusCode).toBe(413);
    });
  });
});
