import { IncomingMessage } from 'node:http';
import { AxiosError } from 'axios';
import { stdSerializers } from 'pino';
import { createPinoConfig } from './pino.config';

type RequestSerializer = (req: unknown) => Record<string, unknown>;

function serializeRequest(raw: object) {
  const { serializers } = createPinoConfig().pinoHttp as {
    serializers: { req: RequestSerializer };
  };
  // pino-http hands the custom serializer pino's own request summary, not the raw request
  return stdSerializers.wrapRequestSerializer(serializers.req)(
    raw as unknown as IncomingMessage,
  );
}

describe('createPinoConfig request serializer', () => {
  const raw = {
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'user-agent': 'jest' },
    socket: { remoteAddress: '172.18.0.2', remotePort: 51234 },
  };

  it('logs the client ip resolved for the request', () => {
    expect(serializeRequest({ ...raw, ip: '198.51.100.20' })).toMatchObject({
      ip: '198.51.100.20',
    });
  });

  it('falls back to the socket address when no ip was resolved', () => {
    expect(serializeRequest(raw)).toMatchObject({ ip: '172.18.0.2' });
  });
});

describe('createPinoConfig error serializer', () => {
  function serializeError(err: Error) {
    const { serializers } = createPinoConfig().pinoHttp as {
      serializers: { err: (err: unknown) => Record<string, unknown> };
    };
    // pino-http hands the custom serializer pino's own error summary, not the raw error
    return stdSerializers.wrapErrorSerializer(serializers.err)(err);
  }

  it('keeps the request outline of an axios error but not its auth header', () => {
    const config: any = {
      method: 'get',
      baseURL: 'https://wiki.example.com',
      url: '/rest/api/content/1?expand=body.storage',
      headers: { Authorization: 'Bearer secret-token' },
    };
    const err = new AxiosError(
      'Request failed with status code 404',
      'ERR_BAD_REQUEST',
      config,
      { path: '/rest/api/content/1' },
      {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'No content found' },
        headers: {},
        config,
      } as any,
    );

    const serialized = serializeError(err);

    expect(JSON.stringify(serialized)).not.toContain('secret-token');
    expect(serialized).not.toHaveProperty('config');
    expect(serialized).not.toHaveProperty('request');
    expect(serialized).not.toHaveProperty('response');
    expect(serialized).toMatchObject({
      message: 'Request failed with status code 404',
      code: 'ERR_BAD_REQUEST',
      status: 404,
      method: 'GET',
      url: 'https://wiki.example.com/rest/api/content/1',
    });
  });

  it('leaves other errors as pino serializes them', () => {
    const err = Object.assign(new Error('db down'), { code: 'ECONNREFUSED' });

    expect(serializeError(err)).toMatchObject({
      type: 'Error',
      message: 'db down',
      code: 'ECONNREFUSED',
    });
  });
});
