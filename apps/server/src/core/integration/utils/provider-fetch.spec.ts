import * as http from 'http';
import { AddressInfo } from 'net';
import {
  ProviderApiError,
  TokenInvalidError,
} from '../registry/integration-provider.interface';
import { MAX_PROVIDER_RESPONSE_BYTES, providerApiFetch } from './provider-fetch';

type TestServer = { server: http.Server; url: string; hits: number };

// Never ends the body, so the request settles only if the client stops reading.
function streamUntilClosed(res: http.ServerResponse, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  const chunk = Buffer.from(`{"secret":"${'s'.repeat(64 * 1024)}"}`);
  const pump = () => {
    while (!res.destroyed && res.write(chunk)) {}
    if (!res.destroyed) res.once('drain', pump);
  };
  pump();
}

async function startServer(
  respond: (res: http.ServerResponse) => void,
): Promise<TestServer> {
  const testServer = { hits: 0 } as TestServer;
  testServer.server = http.createServer((req, res) => {
    testServer.hits += 1;
    req.resume();
    req.on('end', () => respond(res));
  });
  await new Promise<void>((resolve) =>
    testServer.server.listen(0, '127.0.0.1', resolve),
  );
  const { port } = testServer.server.address() as AddressInfo;
  testServer.url = `http://127.0.0.1:${port}`;
  return testServer;
}

function stopServer({ server }: TestServer): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('providerApiFetch', () => {
  let sink: TestServer;
  let provider: TestServer;

  beforeAll(async () => {
    sink = await startServer((res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    provider = await startServer((res) => {
      res.writeHead(307, { Location: `${sink.url}/internal` });
      res.end();
    });
  });

  afterAll(async () => {
    await Promise.all([stopServer(provider), stopServer(sink)]);
  });

  it('reports a redirecting provider endpoint as an unexpected redirect instead of following it', async () => {
    const outcome = await providerApiFetch('acme', `${provider.url}/api/item`, {
      headers: { Authorization: 'Bearer token' },
    }).catch((err) => err);

    expect(sink.hits).toBe(0);
    expect(outcome).toBeInstanceOf(ProviderApiError);
    expect(outcome.status).toBe(502);
    expect(outcome.message).toBe('acme API error: 502 unexpected redirect');
  });

  it('keeps the reason a 401 gives in its body and headers', async () => {
    const refusing = await startServer((res) => {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate':
          'Bearer authorization_uri=https://login.microsoftonline.com/tenant-1',
        'X-TFS-ServiceError': 'TF400813%3a+The+user+is+not+authorized',
      });
      res.end('{"message":"Bad credentials"}');
    });

    try {
      const outcome = await providerApiFetch(
        'acme',
        `${refusing.url}/api/item`,
      ).catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(outcome.message).toBe(
        'acme API error: 401 Unauthorized {"message":"Bad credentials"} Bearer authorization_uri=https://login.microsoftonline.com/tenant-1 TF400813%3a+The+user+is+not+authorized',
      );
    } finally {
      await stopServer(refusing);
    }
  });

  it('reports a bare 401 with the status alone', async () => {
    const refusing = await startServer((res) => {
      res.writeHead(401);
      res.end();
    });

    try {
      const outcome = await providerApiFetch(
        'acme',
        `${refusing.url}/api/item`,
      ).catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(outcome.message).toBe('acme API error: 401 Unauthorized');
    } finally {
      await stopServer(refusing);
    }
  });

  describe('response size cap', () => {
    async function fetchFrom(respond: (res: http.ServerResponse) => void) {
      const testServer = await startServer(respond);
      try {
        return await providerApiFetch('acme', `${testServer.url}/api/item`).catch(
          (err) => err,
        );
      } finally {
        await stopServer(testServer);
      }
    }

    it('hands back the status, headers and body of a response within the cap', async () => {
      const body = `"${'a'.repeat(MAX_PROVIDER_RESPONSE_BYTES - 2)}"`;

      const response = await fetchFrom((res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Request-Id': 'req-1',
        });
        res.end(body);
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(
        'application/json; charset=utf-8',
      );
      expect(response.headers.get('x-request-id')).toBe('req-1');
      expect(await response.json()).toHaveLength(MAX_PROVIDER_RESPONSE_BYTES - 2);
    });

    it('refuses a declared length over the cap without waiting for the body', async () => {
      const outcome = await fetchFrom((res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': String(MAX_PROVIDER_RESPONSE_BYTES + 1),
        });
        res.write('{"secret":"');
      });

      expect(outcome).toBeInstanceOf(ProviderApiError);
      expect(outcome.status).toBe(502);
      expect(outcome.message).toBe('acme API error: 502 response too large');
    }, 2000);

    it('stops reading a body that never ends once it passes the cap', async () => {
      const outcome = await fetchFrom((res) => streamUntilClosed(res));

      expect(outcome).toBeInstanceOf(ProviderApiError);
      expect(outcome.status).toBe(502);
      expect(outcome.message).toBe('acme API error: 502 response too large');
    }, 5000);

    it('keeps the status of an error whose body is too large to quote', async () => {
      const outcome = await fetchFrom((res) => streamUntilClosed(res, 500));

      expect(outcome).toBeInstanceOf(ProviderApiError);
      expect(outcome.status).toBe(500);
      expect(outcome.message).toBe('acme API error: 500 Internal Server Error');
    }, 5000);
  });
});
