import {
  IntegrationNotConfiguredError,
  IntegrationNotConnectedError,
  IntegrationOAuthClientService,
  IntegrationReconnectRequiredError,
} from './integration-oauth-client.service';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationManifest } from './manifest.types';
import { DecryptedTokens, IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthConnectionService } from './integration-oauth-connection.service';
import { outboundFetch, OutboundResponse } from './outbound-url-guard';

jest.mock('./outbound-url-guard', () => {
  const actual = jest.requireActual('./outbound-url-guard');
  return {
    ...actual,
    outboundFetch: jest.fn(),
    readOutboundBody: jest.fn((resp: { __body?: string }) =>
      Promise.resolve(resp.__body ?? ''),
    ),
  };
});

const INTEGRATION_ID = 'alpha:1111';
const WS = 'ws-1';
const UID = 'user-1';

const outboundFetchMock = outboundFetch as jest.MockedFunction<typeof outboundFetch>;

function fakeResponse(status: number, body: unknown): OutboundResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    __body: JSON.stringify(body),
  } as unknown as OutboundResponse;
}

function tokens(overrides: Partial<DecryptedTokens> = {}): DecryptedTokens {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    scopes: 'read',
    needsReconnect: false,
    ...overrides,
  };
}

describe('IntegrationOAuthClientService', () => {
  let registry: IntegrationOAuthRegistry;
  let oauthService: jest.Mocked<
    Pick<IntegrationOAuthService, 'getTokens' | 'refreshTokens' | 'markNeedsReconnect'>
  >;
  let connectionService: jest.Mocked<Pick<IntegrationOAuthConnectionService, 'requireEnabled'>>;
  let service: IntegrationOAuthClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new IntegrationOAuthRegistry();
    registry.register({
      id: 'alpha',
      name: 'Alpha',
      baseUrl: () => 'https://provider.example.com',
      authorizePath: '/oauth/authorize',
      tokenPath: '/oauth/token',
      scopes: ['read'],
      clientIdEnv: 'TEST_CLIENT_ID',
      clientSecretEnv: 'TEST_CLIENT_SECRET',
    } as IntegrationManifest);

    oauthService = {
      getTokens: jest.fn().mockResolvedValue(tokens()),
      refreshTokens: jest.fn().mockResolvedValue(tokens({ accessToken: 'access-2' })),
      markNeedsReconnect: jest.fn().mockResolvedValue(undefined),
    };
    connectionService = {
      requireEnabled: jest.fn().mockResolvedValue({
        baseUrl: 'https://provider.example.com',
        settings: {},
      }),
    };
    service = new IntegrationOAuthClientService(
      registry,
      oauthService as unknown as IntegrationOAuthService,
      connectionService as unknown as IntegrationOAuthConnectionService,
    );
  });

  it('performs an authenticated GET and parses the JSON body', async () => {
    outboundFetchMock.mockResolvedValue(fakeResponse(200, { hello: 'world' }));
    const body = await service.get(INTEGRATION_ID, WS, UID, '/api/things', { q: 'x' });
    expect(body).toEqual({ hello: 'world' });
    const [url, init] = outboundFetchMock.mock.calls[0];
    expect(url).toBe('https://provider.example.com/api/things?q=x');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('throws NotConfigured when no enabled connection exists', async () => {
    connectionService.requireEnabled.mockRejectedValue(new Error('disabled'));
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toBeInstanceOf(
      IntegrationNotConfiguredError,
    );
    expect(outboundFetchMock).not.toHaveBeenCalled();
  });

  it('throws NotConnected when the user has no tokens', async () => {
    oauthService.getTokens.mockResolvedValue(null as unknown as DecryptedTokens);
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toBeInstanceOf(
      IntegrationNotConnectedError,
    );
  });

  it('throws ReconnectRequired when tokens are flagged', async () => {
    oauthService.getTokens.mockResolvedValue(tokens({ needsReconnect: true }));
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toBeInstanceOf(
      IntegrationReconnectRequiredError,
    );
  });

  it('proactively refreshes expired tokens before the request', async () => {
    oauthService.getTokens.mockResolvedValue(
      tokens({ expiresAt: new Date(Date.now() - 1000) }),
    );
    outboundFetchMock.mockResolvedValue(fakeResponse(200, {}));
    await service.get(INTEGRATION_ID, WS, UID, '/api/things');
    expect(oauthService.refreshTokens).toHaveBeenCalledTimes(1);
    const [, init] = outboundFetchMock.mock.calls[0];
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
  });

  it('refreshes once on a 401 and retries with the new token', async () => {
    outboundFetchMock
      .mockResolvedValueOnce(fakeResponse(401, {}))
      .mockResolvedValueOnce(fakeResponse(200, { ok: true }));
    const body = await service.get(INTEGRATION_ID, WS, UID, '/api/things');
    expect(body).toEqual({ ok: true });
    expect(oauthService.refreshTokens).toHaveBeenCalledTimes(1);
    const [, retryInit] = outboundFetchMock.mock.calls[1];
    expect((retryInit!.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
  });

  it('marks reconnect when the retry also 401s', async () => {
    outboundFetchMock.mockResolvedValue(fakeResponse(401, {}));
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toBeInstanceOf(
      IntegrationReconnectRequiredError,
    );
    expect(oauthService.markNeedsReconnect).toHaveBeenCalledWith(UID, WS, INTEGRATION_ID);
  });

  it('marks reconnect when refresh itself fails', async () => {
    outboundFetchMock.mockResolvedValue(fakeResponse(401, {}));
    oauthService.refreshTokens.mockRejectedValue(new Error('refresh denied'));
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toBeInstanceOf(
      IntegrationReconnectRequiredError,
    );
    expect(oauthService.markNeedsReconnect).toHaveBeenCalled();
  });

  it('surfaces provider errors with their status', async () => {
    outboundFetchMock.mockResolvedValue(fakeResponse(404, { error: 'nope' }));
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('caches GETs per user/integration/path+query', async () => {
    outboundFetchMock.mockResolvedValue(fakeResponse(200, { n: 1 }));
    await service.get(INTEGRATION_ID, WS, UID, '/api/things', { q: 'a' });
    await service.get(INTEGRATION_ID, WS, UID, '/api/things', { q: 'a' });
    expect(outboundFetchMock).toHaveBeenCalledTimes(1);

    await service.get(INTEGRATION_ID, WS, UID, '/api/things', { q: 'b' });
    expect(outboundFetchMock).toHaveBeenCalledTimes(2);

    await service.get(INTEGRATION_ID, WS, 'user-2', '/api/things', { q: 'a' });
    expect(outboundFetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not cache failed responses', async () => {
    outboundFetchMock
      .mockResolvedValueOnce(fakeResponse(500, {}))
      .mockResolvedValueOnce(fakeResponse(200, { ok: true }));
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).rejects.toMatchObject({
      status: 500,
    });
    await expect(service.get(INTEGRATION_ID, WS, UID, '/api/things')).resolves.toEqual({
      ok: true,
    });
  });

  it('deduplicates concurrent refreshes behind one lock', async () => {
    let resolveRefresh: (t: DecryptedTokens) => void;
    oauthService.refreshTokens.mockReturnValue(
      new Promise<DecryptedTokens>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    oauthService.getTokens.mockResolvedValue(
      tokens({ expiresAt: new Date(Date.now() - 1000) }),
    );
    outboundFetchMock.mockResolvedValue(fakeResponse(200, {}));

    const first = service.get(INTEGRATION_ID, WS, UID, '/api/a');
    const second = service.get(INTEGRATION_ID, WS, UID, '/api/b');
    await new Promise((r) => setImmediate(r));
    resolveRefresh!(tokens({ accessToken: 'access-2' }));
    await Promise.all([first, second]);
    expect(oauthService.refreshTokens).toHaveBeenCalledTimes(1);
  });
});
