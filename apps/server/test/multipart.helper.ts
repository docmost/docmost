import * as net from 'node:net';
import { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { FastifyAdapter } from '@nestjs/platform-fastify';

const BOUNDARY = 'spec-boundary';

export const MULTIPART_HEADERS = {
  'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
};

export function multipartFields(fields: Record<string, string>): Buffer {
  return Buffer.from(
    Object.entries(fields)
      .map(
        ([name, value]) =>
          `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      )
      .join(''),
  );
}

export function multipartHead(
  fileName: string,
  fields: Record<string, string> = {},
): Buffer {
  return Buffer.concat([
    multipartFields(fields),
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
  ]);
}

export const MULTIPART_TAIL = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);

export function multipartBody(
  fileName: string,
  content: Buffer,
  fields: Record<string, string> = {},
): Buffer {
  return Buffer.concat([multipartHead(fileName, fields), content, MULTIPART_TAIL]);
}

export async function createMultipartApp(
  routes: Record<string, (req: any, res: any) => Promise<unknown>>,
): Promise<FastifyInstance> {
  const app = new FastifyAdapter().getInstance();
  await app.register(fastifyMultipart);

  // stands in for Nest's exception filter
  app.setErrorHandler((err: any, _req: FastifyRequest, res) =>
    res
      .status(err.getStatus?.() ?? err.statusCode ?? 500)
      .send({ message: err.message }),
  );

  for (const [url, handler] of Object.entries(routes)) {
    app.post(url, handler);
  }

  await app.listen({ port: 0, host: '127.0.0.1' });
  return app;
}

function connect(app: FastifyInstance, url: string, contentLength: number) {
  const { port } = app.server.address() as net.AddressInfo;
  const socket = net.connect(port, '127.0.0.1');
  socket.write(
    `POST ${url} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n` +
      `Content-Type: ${MULTIPART_HEADERS['content-type']}\r\n` +
      `Content-Length: ${contentLength}\r\n\r\n`,
  );
  return socket;
}

// Sends each chunk as its own socket write, with a pause so the server drains it first
export function postInChunks(
  app: FastifyInstance,
  url: string,
  chunks: Buffer[],
): Promise<{ statusCode: number; body: string }> {
  const contentLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  return new Promise((resolve, reject) => {
    const socket = connect(app, url, contentLength);
    let response = '';
    socket.on('data', (data) => (response += data.toString()));
    socket.on('error', reject);
    socket.on('close', () =>
      resolve({
        statusCode: Number(response.split(' ')[1]),
        body: response.split('\r\n\r\n')[1],
      }),
    );

    (async () => {
      for (const chunk of chunks) {
        socket.write(chunk);
        await new Promise((done) => setTimeout(done, 50));
      }
    })();
  });
}

// Announces more bytes than it sends, then drops the connection once the server has the file
export async function postAndDisconnect(
  app: FastifyInstance,
  url: string,
  partialBody: Buffer,
  fileReceived: Promise<unknown>,
): Promise<void> {
  const socket = connect(app, url, partialBody.length + 1024 * 1024);
  socket.write(partialBody);
  await fileReceived;
  socket.destroy();
}
