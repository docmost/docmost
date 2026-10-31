import { FastifyInstance } from 'fastify';
import { prepareFile } from './attachment.utils';
import {
  createMultipartApp,
  MULTIPART_HEADERS,
  MULTIPART_TAIL,
  multipartBody,
  multipartHead,
  postInChunks,
} from '../../../test/multipart.helper';

const LIMIT = 1024;

describe('prepareFile', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createMultipartApp({
      '/upload': async (req, res) => {
        const file = req.file({ limits: { fileSize: LIMIT } });
        const { fileSize, fileName } = await prepareFile(file);
        return res.send({ fileSize, fileName });
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('buffers a file exactly at the limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: MULTIPART_HEADERS,
      payload: multipartBody('a.bin', Buffer.alloc(LIMIT)),
    });

    expect(response.json()).toEqual({ fileSize: LIMIT, fileName: 'a.bin' });
  });

  it('rejects when a chunk boundary lands exactly on the limit', async () => {
    const response = await postInChunks(app, '/upload', [
      Buffer.concat([multipartHead('a.bin'), Buffer.alloc(LIMIT)]),
      Buffer.alloc(100),
      MULTIPART_TAIL,
    ]);

    expect(response.statusCode).toBe(413);
  });
});
