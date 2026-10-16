import { IncomingMessage } from 'node:http';
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
