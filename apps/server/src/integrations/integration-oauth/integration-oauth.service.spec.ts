import { createHash } from 'node:crypto';
import { Cache } from 'cache-manager';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationManifest } from './manifest.types';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';
import { IntegrationOAuthConnectionService } from './integration-oauth-connection.service';
import { EnvironmentService } from '../environment/environment.service';
import { decryptString } from '../../common/helpers/encryption.helper';
import { outboundFetch } from './outbound-url-guard';

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

const APP_SECRET = 'test-app-secret-with-enough-entropy-0123456789';
const INTEGRATION_ID = 'alpha:1111';
const TOKEN_INFO = 'integration-oauth-token-v1';

const outboundFetchMock = outboundFetch as jest.MockedFunction<typeof outboundFetch>;

function fakeResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    __body: JSON.stringify(body),
  } as never;
}

function memoryCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as Cache;
}

describe('IntegrationOAuthService', () => {
  let registry: IntegrationOAuthRegistry;
  let tokenRepo: { upsert: jest.Mock; findByUserWorkspaceAndIntegration: jest.Mock };
  let connectionService: { requireEnabled: jest.Mock; callbackUrl: jest.Mock };
  let cache: Cache;
  let service: IntegrationOAuthService;

  function buildService(manifestOverrides: Partial<IntegrationManifest> = {}) {
    registry = new IntegrationOAuthRegistry();
    registry.register({
      id: 'alpha',
      name: 'Alpha',
      baseUrl: () => 'https://provider.example.com',
      authorizePath: '/oauth/authorize',
      tokenPath: '/oauth/token',
      scopes: ['items:read', 'workspaces:read'],
      scopeSeparator: ' ',
      pkce: true,
      clientIdEnv: 'TEST_CLIENT_ID',
      clientSecretEnv: 'TEST_CLIENT_SECRET',
      ...manifestOverrides,
    } as IntegrationManifest);

    tokenRepo = {
      upsert: jest.fn().mockResolvedValue({}),
      findByUserWorkspaceAndIntegration: jest.fn().mockResolvedValue(null),
    };
    connectionService = {
      requireEnabled: jest.fn().mockResolvedValue({
        integrationId: INTEGRATION_ID,
        baseUrl: 'https://provider.example.com',
        oauthClientId: 'client-1',
        oauthClientSecret: 'secret-1',
        settings: {},
      }),
      callbackUrl: jest.fn(
        (id: string) => `https://docmost.example.com/api/integrations/oauth/${id}/callback`,
      ),
    };
    cache = memoryCache();
    service = new IntegrationOAuthService(
      registry,
      tokenRepo as unknown as IntegrationOAuthTokenRepo,
      connectionService as unknown as IntegrationOAuthConnectionService,
      { getAppSecret: () => APP_SECRET } as unknown as EnvironmentService,
      cache,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    buildService();
  });

  async function startAuthorize() {
    return service.startAuthorize({
      integrationId: INTEGRATION_ID,
      workspaceId: 'ws-1',
      userId: 'user-1',
      returnTo: '/settings/account/integrations',
    });
  }

  describe('startAuthorize', () => {
    it('builds the authorize URL with client, scopes, state, and PKCE challenge', async () => {
      const { url } = await startAuthorize();
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        'https://provider.example.com/oauth/authorize',
      );
      expect(parsed.searchParams.get('client_id')).toBe('client-1');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('items:read workspaces:read');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        `https://docmost.example.com/api/integrations/oauth/${INTEGRATION_ID}/callback`,
      );
      expect(parsed.searchParams.get('state')).toMatch(/^[0-9a-f]{64}$/);
      expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('derives the S256 challenge from the stored verifier', async () => {
      const { url } = await startAuthorize();
      const state = new URL(url).searchParams.get('state')!;
      const stored = await cache.get<{ codeVerifier?: string }>(
        `integration-oauth:state:${state}`,
      );
      const expected = createHash('sha256')
        .update(stored!.codeVerifier!)
        .digest('base64url');
      expect(new URL(url).searchParams.get('code_challenge')).toBe(expected);
    });

    it('omits PKCE params for non-PKCE providers', async () => {
      buildService({ pkce: false });
      const { url } = await startAuthorize();
      expect(new URL(url).searchParams.get('code_challenge')).toBeNull();
    });

    it('issues a fresh state per authorize call', async () => {
      const first = new URL((await startAuthorize()).url).searchParams.get('state');
      const second = new URL((await startAuthorize()).url).searchParams.get('state');
      expect(first).not.toBe(second);
    });
  });

  describe('completeCallback', () => {
    async function authorizeAndGetState(): Promise<string> {
      const { url } = await startAuthorize();
      return new URL(url).searchParams.get('state')!;
    }

    it('exchanges the code with the verifier and persists encrypted tokens', async () => {
      const state = await authorizeAndGetState();
      outboundFetchMock.mockResolvedValue(
        fakeResponse(200, {
          access_token: 'provider-access',
          refresh_token: 'provider-refresh',
          expires_in: 3600,
          scope: 'items:read',
        }),
      );

      const result = await service.completeCallback({
        integrationId: INTEGRATION_ID,
        code: 'auth-code',
        stateToken: state,
      });
      expect(result).toMatchObject({
        userId: 'user-1',
        workspaceId: 'ws-1',
        returnTo: '/settings/account/integrations',
      });

      const [tokenUrl, init] = outboundFetchMock.mock.calls[0];
      expect(tokenUrl).toBe('https://provider.example.com/oauth/token');
      const sent = new URLSearchParams(init!.body as string);
      expect(sent.get('grant_type')).toBe('authorization_code');
      expect(sent.get('code')).toBe('auth-code');
      expect(sent.get('code_verifier')).toBeTruthy();

      const row = tokenRepo.upsert.mock.calls[0][0];
      expect(row.accessTokenEncrypted).not.toContain('provider-access');
      expect(decryptString(row.accessTokenEncrypted, APP_SECRET, TOKEN_INFO)).toBe(
        'provider-access',
      );
      expect(decryptString(row.refreshTokenEncrypted, APP_SECRET, TOKEN_INFO)).toBe(
        'provider-refresh',
      );
    });

    it('rejects replayed state: the second callback with the same token fails', async () => {
      const state = await authorizeAndGetState();
      outboundFetchMock.mockResolvedValue(
        fakeResponse(200, { access_token: 'a', expires_in: 60 }),
      );
      await service.completeCallback({
        integrationId: INTEGRATION_ID,
        code: 'code-1',
        stateToken: state,
      });
      await expect(
        service.completeCallback({
          integrationId: INTEGRATION_ID,
          code: 'code-2',
          stateToken: state,
        }),
      ).rejects.toThrow(/Invalid or expired OAuth state/);
    });

    it('rejects unknown state tokens', async () => {
      await expect(
        service.completeCallback({
          integrationId: INTEGRATION_ID,
          code: 'code',
          stateToken: 'f'.repeat(64),
        }),
      ).rejects.toThrow(/Invalid or expired OAuth state/);
    });

    it('rejects a state minted for a different integration', async () => {
      const state = await authorizeAndGetState();
      await expect(
        service.completeCallback({
          integrationId: 'alpha:2222',
          code: 'code',
          stateToken: state,
        }),
      ).rejects.toThrow(/does not match callback integration/);
    });

    it('surfaces provider token-endpoint failures', async () => {
      const state = await authorizeAndGetState();
      outboundFetchMock.mockResolvedValue(
        fakeResponse(400, { error: 'invalid_grant' }),
      );
      await expect(
        service.completeCallback({
          integrationId: INTEGRATION_ID,
          code: 'bad-code',
          stateToken: state,
        }),
      ).rejects.toThrow(/token exchange failed \(400\)/);
    });
  });

  describe('refreshTokens', () => {
    function storedRow(secret: string) {
      const { encryptString } = jest.requireActual(
        '../../common/helpers/encryption.helper',
      );
      return {
        accessTokenEncrypted: encryptString('old-access', secret, TOKEN_INFO),
        refreshTokenEncrypted: encryptString('old-refresh', secret, TOKEN_INFO),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        scopes: 'items:read',
        needsReconnect: false,
      };
    }

    it('keeps the previous refresh token when the provider does not rotate it', async () => {
      tokenRepo.findByUserWorkspaceAndIntegration.mockResolvedValue(
        storedRow(APP_SECRET),
      );
      outboundFetchMock.mockResolvedValue(
        fakeResponse(200, { access_token: 'new-access', expires_in: 3600 }),
      );
      tokenRepo.upsert.mockImplementation(async (row) => {
        // Subsequent getTokens reads back what was just stored.
        tokenRepo.findByUserWorkspaceAndIntegration.mockResolvedValue({
          ...row,
          needsReconnect: false,
        });
        return row;
      });

      const refreshed = await service.refreshTokens('user-1', 'ws-1', INTEGRATION_ID);
      expect(refreshed.accessToken).toBe('new-access');
      expect(refreshed.refreshToken).toBe('old-refresh');

      const sent = new URLSearchParams(
        outboundFetchMock.mock.calls[0][1]!.body as string,
      );
      expect(sent.get('grant_type')).toBe('refresh_token');
      expect(sent.get('refresh_token')).toBe('old-refresh');
    });

    it('throws when no refresh token is stored', async () => {
      tokenRepo.findByUserWorkspaceAndIntegration.mockResolvedValue(null);
      await expect(
        service.refreshTokens('user-1', 'ws-1', INTEGRATION_ID),
      ).rejects.toThrow(/No refresh token/);
    });
  });
});
