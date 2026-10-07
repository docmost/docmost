import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../casl/abilities/workspace-ability.factory';
import { UserRole } from '../../../common/helpers/types/permission';
import { OAuthService, OAuthStatePayload } from './oauth.service';
import {
  IdentityEmailMismatchError,
  ProviderApiError,
  TokenExpiredError,
  TokenInvalidError,
} from '../registry/integration-provider.interface';

type RecordedRequest = { method: string; url: string; body: string; authorization?: string };

type TestServer = {
  server: http.Server;
  url: string;
  requests: RecordedRequest[];
};

type Reply = (req: RecordedRequest, res: http.ServerResponse) => void;

function startServer(respond: Reply): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const recorded: RecordedRequest = { method: req.method ?? '', url: req.url ?? '', body };
      if (req.headers.authorization) recorded.authorization = req.headers.authorization;
      requests.push(recorded);
      respond(recorded, res);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, requests });
    });
  });
}

function stopServer({ server }: TestServer): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function tokenJson(res: http.ServerResponse, body: Record<string, unknown> | null) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const tokenError = (status: number, body: string): Reply => (_req, res) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
};

// Never ends the body, so the request settles only if the client stops reading.
function streamUntilClosed(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  const chunk = Buffer.from(`{"access_token":"${'a'.repeat(64 * 1024)}"}`);
  const pump = () => {
    while (!res.destroyed && res.write(chunk)) { /* Keep streaming until backpressure. */ }
    if (!res.destroyed) res.once('drain', pump);
  };
  pump();
}

// Emulates SET NX, the compare-and-delete release script and EXISTS over a Map.
function fakeRedis() {
  const keys = new Map<string, string>();
  return {
    keys,
    set: jest.fn(async (key: string, value: string) => {
      if (keys.has(key)) return null;
      keys.set(key, value);
      return 'OK';
    }),
    eval: jest.fn(async (_script: string, _numKeys: number, key: string, token: string) => {
      if (keys.get(key) !== token) return 0;
      keys.delete(key);
      return 1;
    }),
    exists: jest.fn(async (key: string) => (keys.has(key) ? 1 : 0)),
  };
}

function decodeState(authorizationUrl: string): OAuthStatePayload {
  const state = new URL(authorizationUrl).searchParams.get('state') ?? '';
  const data = state.substring(0, state.lastIndexOf('.'));
  return JSON.parse(Buffer.from(data, 'base64url').toString());
}

describe('OAuthService', () => {
  const workspaceId = 'workspace-1';
  const userId = 'user-1';
  const integrations: Record<string, any> = {
    'integration-acme': { id: 'integration-acme', type: 'acme', workspaceId, settings: {} },
    'integration-chat': { id: 'integration-chat', type: 'chat', workspaceId, settings: { tenantId: 'T-1' } },
    'integration-legacy': { id: 'integration-legacy', type: 'legacy', workspaceId, settings: {} },
    'integration-hidden': { id: 'integration-hidden', type: 'hidden', workspaceId, settings: {} },
    'integration-entra': { id: 'integration-entra', type: 'entra', workspaceId, settings: {} },
    'integration-design': { id: 'integration-design', type: 'design', workspaceId, settings: {} },
    'integration-foreign': { id: 'integration-foreign', type: 'acme', workspaceId: 'workspace-2', settings: {} },
  };

  let sink: TestServer;
  let tokenEndpoint: TestServer;
  let tokenEndpointReply: Reply;
  let currentRole: UserRole;
  let currentUserDisabledAt: Date | null;
  let currentUserEmail: string;
  let resolveIdentity: jest.Mock;
  let chatOnConnected: jest.Mock;
  let acmeOnConnected: jest.Mock;
  let connectionRepo: Record<string, jest.Mock>;
  let integrationRepo: Record<string, jest.Mock>;
  let db: { transaction: jest.Mock };
  let auditService: { log: jest.Mock };
  let redis: ReturnType<typeof fakeRedis>;
  let service: OAuthService;
  const trx = { name: 'install-trx' };

  const installState = (type: string) => ({ flow: 'install' as const, integrationId: null, type, userId, workspaceId });
  const connectState = (integrationId: string, type: string) => ({ flow: 'connect' as const, integrationId, type, userId, workspaceId });

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    for (const type of ['ACME', 'CHAT', 'LEGACY', 'HIDDEN', 'ENTRA', 'DESIGN']) {
      process.env[`INTEGRATION_${type}_CLIENT_ID`] = `${type.toLowerCase()}-client-id`;
      process.env[`INTEGRATION_${type}_CLIENT_SECRET`] = `${type.toLowerCase()}-client-secret`;
    }
    sink = await startServer((_req, res) => tokenJson(res, { access_token: 'stolen' }));
    tokenEndpoint = await startServer((req, res) => tokenEndpointReply(req, res));
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    for (const type of ['ACME', 'CHAT', 'LEGACY', 'HIDDEN', 'ENTRA', 'DESIGN']) {
      delete process.env[`INTEGRATION_${type}_CLIENT_ID`];
      delete process.env[`INTEGRATION_${type}_CLIENT_SECRET`];
    }
    await Promise.all([stopServer(tokenEndpoint), stopServer(sink)]);
  });

  beforeEach(() => {
    sink.requests.length = 0;
    tokenEndpoint.requests.length = 0;
    tokenEndpointReply = (_req, res) => {
      res.writeHead(307, { Location: `${sink.url}/collect` });
      res.end();
    };
    currentRole = UserRole.ADMIN;
    currentUserDisabledAt = null;
    currentUserEmail = 'user@example.com';
    resolveIdentity = jest.fn(async ({ settings }) => ({
      providerUserId: 'U-42',
      metadata: { tenantId: settings.tenantId },
    }));
    chatOnConnected = jest.fn(async () => undefined);
    acmeOnConnected = jest.fn(async () => undefined);

    const providerOAuth = (scopes: string[]) => ({
      authUrl: `${tokenEndpoint.url}/oauth/authorize`,
      tokenUrl: `${tokenEndpoint.url}/oauth/token`,
      scopes,
    });
    const chatOAuth = {
      ...providerOAuth(['bot']),
      authParams: { prompt: 'consent' },
      connectionScope: 'workspace' as const,
      identity: {
        authUrl: `${tokenEndpoint.url}/openid/authorize`,
        tokenUrl: `${tokenEndpoint.url}/openid/token`,
        scopes: ['openid', 'profile'],
      },
    };
    const providers: Record<string, any> = {
      acme: {
        definition: {
          type: 'acme',
          oauth: {
            ...providerOAuth(['read']),
            authParams: { audience: 'api.acme.test', client_id: 'forged' },
          },
        },
        onConnected: acmeOnConnected,
      },
      chat: {
        definition: { type: 'chat', oauth: chatOAuth },
        getOAuthConfig: (settings: Record<string, any>) => ({
          ...chatOAuth,
          identity: { ...chatOAuth.identity, authParams: { team: settings.tenantId } },
        }),
        resolveIdentity,
        onConnected: chatOnConnected,
      },
      legacy: {
        definition: {
          type: 'legacy',
          oauth: { ...providerOAuth(['bot']), connectionScope: 'workspace' as const },
        },
      },
      hidden: {
        definition: { type: 'hidden', hidden: true, oauth: providerOAuth(['read']) },
      },
      entra: {
        definition: {
          type: 'entra',
          oauth: {
            ...providerOAuth(['api://resource/items.read', 'offline_access']),
            scopeOnRefresh: true,
          },
        },
      },
      design: {
        definition: {
          type: 'design',
          oauth: {
            ...providerOAuth(['file_metadata:read']),
            refreshUrl: `${tokenEndpoint.url}/oauth/refresh`,
            clientAuth: 'basic' as const,
          },
        },
      },
    };

    connectionRepo = {
      upsert: jest.fn(async (values) => values),
      upsertWorkspaceConnection: jest.fn(async (values) => values),
      upsertUserLink: jest.fn(async (values) => values),
      findUserLink: jest.fn(async () => undefined),
      findById: jest.fn(async () => undefined),
      updateIfTokensMatch: jest.fn(async () => true),
      invalidate: jest.fn(async () => undefined),
    };
    integrationRepo = {
      findById: jest.fn(async (id: string) => integrations[id] ?? null),
      findByWorkspaceAndType: jest.fn(async () => null),
      insertOrRestore: jest.fn(async ({ type }: { type: string }) => ({
        id: `integration-${type}`,
        type,
        workspaceId,
        settings: {},
      })),
    };

    auditService = { log: jest.fn() };
    redis = fakeRedis();
    db = {
      transaction: jest.fn(() => ({
        execute: (callback: (t: typeof trx) => Promise<unknown>) => callback(trx),
      })),
    };

    service = new OAuthService(
      db as any,
      {
        getAppUrl: () => 'http://localhost:3000',
        getAppSecret: () => 'test-secret',
      } as any,
      { getWorkspaceUrl: () => 'http://localhost:3000' } as any,
      { getProvider: (type: string) => providers[type] } as any,
      integrationRepo as any,
      connectionRepo as any,
      {
        findById: async () => ({ id: workspaceId, hostname: null, customDomain: null }),
      } as any,
      {
        encrypt: (value: string) => value,
        decrypt: (value: string) => value,
      } as any,
      {
        findById: async () => ({
          id: userId,
          role: currentRole,
          deactivatedAt: currentUserDisabledAt,
          email: currentUserEmail,
        }),
      } as any,
      new WorkspaceAbilityFactory(),
      auditService as any,
      { getOrThrow: () => redis } as any,
    );
  });

  describe('install flow', () => {
    it('stores the issued tokens and audits the installation', async () => {
      tokenEndpointReply = (_req, res) =>
        tokenJson(res, {
          access_token: 'issued-access-token',
          refresh_token: 'issued-refresh-token',
          expires_in: 3600,
        });

      const connection = await service.exchangeCodeForTokens('acme', 'auth-code', installState('acme'));

      expect(tokenEndpoint.requests).toEqual([
        {
          method: 'POST',
          url: '/oauth/token',
          body:
            'grant_type=authorization_code&client_id=acme-client-id&client_secret=acme-client-secret&code=auth-code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fintegrations%2Foauth%2Facme%2Fcallback',
        },
      ]);
      expect(integrationRepo.insertOrRestore).toHaveBeenCalledWith(
        { type: 'acme', workspaceId, installedById: userId },
        trx,
      );
      expect(connection).toMatchObject({
        accessToken: 'issued-access-token',
        refreshToken: 'issued-refresh-token',
      });
      expect(auditService.log).toHaveBeenCalledWith({
        event: 'integration.installed',
        resourceType: 'integration',
        resourceId: 'integration-acme',
        changes: { after: { provider: 'acme' } },
      });
      expect(acmeOnConnected).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: 'integration-acme',
          userId,
          accessToken: 'issued-access-token',
        }),
      );
    });

    it('writes the shared connection for a workspace-scoped provider', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'bot-token' });

      await service.exchangeCodeForTokens('chat', 'auth-code', installState('chat'));

      expect(connectionRepo.upsertWorkspaceConnection).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'integration-chat', userId, accessToken: 'bot-token' }),
        trx,
      );
      expect(chatOnConnected).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'integration-chat', userId, accessToken: 'bot-token' }),
      );
    });

    it.each(['lost permission', 'deactivated'])('refuses an installer who is %s', async (reason) => {
      if (reason === 'lost permission') currentRole = UserRole.MEMBER;
      else currentUserDisabledAt = new Date();

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', installState('chat')),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tokenEndpoint.requests).toEqual([]);
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
      expect(connectionRepo.upsertWorkspaceConnection).not.toHaveBeenCalled();
    });

    it('stops at a redirecting token endpoint instead of re-POSTing the client secret', async () => {
      const outcome = await service
        .exchangeCodeForTokens('acme', 'auth-code', installState('acme'))
        .catch((err) => err);

      expect(sink.requests).toEqual([]);
      expect(tokenEndpoint.requests).toHaveLength(1);
      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('refuses an install state naming an integration from another workspace', async () => {
      await expect(
        service.exchangeCodeForTokens('acme', 'auth-code', {
          flow: 'install',
          integrationId: 'integration-foreign',
          type: 'acme',
          userId,
          workspaceId,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(tokenEndpoint.requests).toEqual([]);
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
    });

    it('refuses to complete an install for a hidden provider without writing', async () => {
      const outcome = await service
        .exchangeCodeForTokens('hidden', 'auth-code', installState('hidden'))
        .catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(tokenEndpoint.requests).toEqual([]);
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('connect flow', () => {
    it('connects a member with a per-user token and audits without reinstalling', async () => {
      currentRole = UserRole.MEMBER;
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'user-token' });

      const connection = await service.exchangeCodeForTokens(
        'acme',
        'auth-code',
        connectState('integration-acme', 'acme'),
      );

      expect(connectionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'integration-acme', userId, accessToken: 'user-token' }),
        undefined,
      );
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
      expect(connection).toMatchObject({ accessToken: 'user-token' });
      expect(acmeOnConnected).not.toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith({
        event: 'integration.connected',
        resourceType: 'integration',
        resourceId: 'integration-acme',
        changes: { after: { provider: 'acme' } },
      });
    });

    it('sends the client credentials as HTTP Basic, not in the body, for a provider that asks for it', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'user-token' });

      await service.exchangeCodeForTokens('design', 'auth-code', connectState('integration-design', 'design'));

      expect(tokenEndpoint.requests).toEqual([
        {
          method: 'POST',
          url: '/oauth/token',
          body: 'grant_type=authorization_code&code=auth-code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fintegrations%2Foauth%2Fdesign%2Fcallback',
          authorization: `Basic ${Buffer.from('design-client-id:design-client-secret').toString('base64')}`,
        },
      ]);
    });

    it('links a member with a matching email without replacing the shared connection', async () => {
      currentRole = UserRole.MEMBER;
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'identity-token' });

      resolveIdentity.mockResolvedValue({ providerUserId: 'U-42', email: 'User@Example.com ', metadata: { tenantId: 'T-1' } });
      const link = await service.exchangeCodeForTokens(
        'chat',
        'auth-code',
        connectState('integration-chat', 'chat'),
      );

      expect(tokenEndpoint.requests.map((r) => r.url)).toEqual(['/openid/token']);
      expect(resolveIdentity).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: 'integration-chat',
          workspaceId,
          userId,
          tokenResponse: { access_token: 'identity-token' },
          settings: { tenantId: 'T-1' },
        }),
      );
      expect(connectionRepo.upsertUserLink).toHaveBeenCalledWith({
        integrationId: 'integration-chat',
        workspaceId,
        userId,
        providerUserId: 'U-42',
        metadata: { tenantId: 'T-1' },
      });
      expect(connectionRepo.upsertWorkspaceConnection).not.toHaveBeenCalled();
      expect(connectionRepo.upsert).not.toHaveBeenCalled();
      expect(chatOnConnected).not.toHaveBeenCalled();
      expect(link).toMatchObject({ providerUserId: 'U-42' });
    });

    it('writes nothing when the provider rejects the identity', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'identity-token' });
      resolveIdentity.mockRejectedValue(new Error('wrong tenant'));

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-chat', 'chat')),
      ).rejects.toThrow('wrong tenant');

      expect(connectionRepo.upsertUserLink).not.toHaveBeenCalled();
      expect(connectionRepo.upsertWorkspaceConnection).not.toHaveBeenCalled();
    });

    it('refuses a workspace-scoped provider without an identity flow', async () => {
      await expect(
        service.exchangeCodeForTokens('legacy', 'auth-code', connectState('integration-legacy', 'legacy')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tokenEndpoint.requests).toEqual([]);
      expect(connectionRepo.upsertWorkspaceConnection).not.toHaveBeenCalled();
    });

    it('refuses a state signed for a different provider', async () => {
      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-acme', 'acme')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tokenEndpoint.requests).toEqual([]);
      expect(connectionRepo.upsert).not.toHaveBeenCalled();
      expect(connectionRepo.upsertUserLink).not.toHaveBeenCalled();
    });

    it('refuses when the provider account email differs from the Docmost user', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'identity-token' });
      resolveIdentity.mockResolvedValue({ providerUserId: 'U-42', email: 'someone-else@example.com' });

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-chat', 'chat')),
      ).rejects.toBeInstanceOf(IdentityEmailMismatchError);

      expect(connectionRepo.upsertUserLink).not.toHaveBeenCalled();
      expect(connectionRepo.findUserLink).not.toHaveBeenCalled();
    });

    it('still connects a member to an existing installation of a hidden provider', async () => {
      currentRole = UserRole.MEMBER;
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'user-token' });
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-hidden', workspaceId, userId);
      expect(decodeState(authorizationUrl)).toMatchObject({ flow: 'connect', integrationId: 'integration-hidden' });

      await service.exchangeCodeForTokens('hidden', 'auth-code', connectState('integration-hidden', 'hidden'));

      expect(connectionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ integrationId: 'integration-hidden', userId, accessToken: 'user-token' }),
        undefined,
      );
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
    });
  });

  describe('tokens from the code exchange', () => {
    const malformed: [string, Record<string, unknown>][] = [
      ['an access token with a line break', { access_token: 'abc\ndef-SECRET' }],
      ['an access token with a space', { access_token: 'abc def-SECRET' }],
      ['an access token with a non-ASCII character', { access_token: 'abcédef-SECRET' }],
      ['no access token', { error: 'invalid_code' }],
      ['an access token that is not a string', { access_token: { value: 'def-SECRET' } }],
      ['a refresh token with an escape character', { access_token: 'access-token', refresh_token: 'abc\x1bdef-SECRET' }],
    ];
    const errorLog = () => jest.mocked(Logger.prototype.error).mock.calls;

    beforeEach(() => {
      jest.mocked(Logger.prototype.error).mockClear();
    });

    it.each(malformed)('fails an install on %s without writing or logging the token', async (_label, body) => {
      tokenEndpointReply = (_req, res) => tokenJson(res, body);

      const outcome = await service
        .exchangeCodeForTokens('acme', 'auth-code', installState('acme'))
        .catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('OAuth token exchange failed');
      expect(db.transaction).not.toHaveBeenCalled();
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
      expect(acmeOnConnected).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(JSON.stringify(errorLog())).not.toContain('SECRET');
    });

    it('fails an identity link on a malformed access token before the provider resolves the identity', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'abc\ndef-SECRET' });

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-chat', 'chat')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(resolveIdentity).not.toHaveBeenCalled();
      expect(connectionRepo.upsertUserLink).not.toHaveBeenCalled();
    });
  });

  describe('token endpoint responses during the code exchange', () => {
    const errorLog = () => jest.mocked(Logger.prototype.error).mock.calls;
    const exchange = (type = 'acme') =>
      service.exchangeCodeForTokens(type, 'auth-code', installState(type)).catch((err) => err);
    const expectNothingWritten = () => {
      expect(db.transaction).not.toHaveBeenCalled();
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
      expect(connectionRepo.upsert).not.toHaveBeenCalled();
    };

    beforeEach(() => {
      jest.mocked(Logger.prototype.error).mockClear();
    });

    it('logs the status and error code of a refused exchange and nothing else from the body', async () => {
      tokenEndpointReply = tokenError(
        401,
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'PRIVATE tenant and secret details',
        }),
      );

      const outcome = await exchange('entra');

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('OAuth token exchange failed');
      expect(errorLog()).toEqual([['Token exchange failed for entra: 401 invalid_client']]);
      expectNothingWritten();
    });

    it('rejects truncated JSON during exchange without writing or logging the body', async () => {
      tokenEndpointReply = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"access_token":"leaked-0f1e2d3c');
      };

      const outcome = await exchange();

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('OAuth token exchange failed');
      expect(errorLog()).toEqual([['Token exchange for acme returned a response that is not JSON']]);
      expectNothingWritten();
    });

    it('stops reading a response that passes the size cap and writes nothing', async () => {
      tokenEndpointReply = (_req, res) => streamUntilClosed(res);

      const outcome = await exchange();

      expect(outcome).toBeInstanceOf(ProviderApiError);
      expect(outcome.message).toBe('acme token endpoint API error: 502 response too large');
      expectNothingWritten();
      expect(acmeOnConnected).not.toHaveBeenCalled();
    }, 5000);
  });

  describe('authorization URLs and signed state', () => {
    it('creates an install URL with provider params and a signed browser nonce', async () => {
      const { authorizationUrl, nonce } = await service.getInstallAuthorizationUrl('chat', workspaceId, userId);
      const url = new URL(authorizationUrl);

      expect(url.origin + url.pathname).toBe(tokenEndpoint.url + '/oauth/authorize');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(service.verifySignedState(url.searchParams.get('state'))).toMatchObject({
        flow: 'install', integrationId: null, type: 'chat', userId, workspaceId, nonce,
      });
      expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('creates a per-user URL without letting provider params override core params', async () => {
      const first = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);
      const second = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);
      const url = new URL(first.authorizationUrl);
      const state = url.searchParams.get('state');

      expect(url.origin + url.pathname).toBe(tokenEndpoint.url + '/oauth/authorize');
      expect(url.searchParams.get('scope')).toBe('read');
      expect(url.searchParams.get('audience')).toBe('api.acme.test');
      expect(url.searchParams.getAll('client_id')).toEqual(['acme-client-id']);
      expect(service.verifySignedState(state)).toMatchObject({
        flow: 'connect', integrationId: 'integration-acme', type: 'acme', userId, workspaceId, nonce: first.nonce,
      });
      expect(second.nonce).not.toBe(first.nonce);

      const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
      try {
        expect(service.verifySignedState(state)).toBeNull();
      } finally {
        now.mockRestore();
      }
    });

    it('uses the workspace identity endpoint, scopes and settings instead of install params', async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-chat', workspaceId, userId);
      const url = new URL(authorizationUrl);

      expect(url.origin + url.pathname).toBe(tokenEndpoint.url + '/openid/authorize');
      expect(url.searchParams.get('team')).toBe('T-1');
      expect(url.searchParams.get('scope')).toBe('openid profile');
      expect(url.searchParams.get('client_id')).toBe('chat-client-id');
      expect(url.searchParams.has('prompt')).toBe(false);
      expect(decodeState(authorizationUrl)).toMatchObject({
        flow: 'connect', integrationId: 'integration-chat', returnPath: '/settings/account/connections',
      });
    });

    it('refuses connect URLs for a workspace provider without an identity flow', async () => {
      await expect(service.getAuthorizationUrl('integration-legacy', workspaceId, userId))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses new installs for a hidden provider', async () => {
      await expect(service.getInstallAuthorizationUrl('hidden', workspaceId, userId))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(integrationRepo.findByWorkspaceAndType).not.toHaveBeenCalled();
    });

    it.each(['tampered', 'short signature', 'no separator', 'raw secret'])('rejects a state with %s', async (kind) => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);
      const state = new URL(authorizationUrl).searchParams.get('state');
      const [data, signature] = state.split('.');
      const invalid = {
        tampered: data + '.' + (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1),
        'short signature': state.slice(0, -1),
        'no separator': data + signature,
        'raw secret': data + '.' + crypto.createHmac('sha256', 'test-secret').update(data).digest('base64url'),
      }[kind];

      expect(service.verifySignedState(invalid)).toBeNull();
    });
  });

  describe('access token for a request', () => {
    const storedConnection = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'connection-1',
        integrationId: 'integration-acme',
        userId,
        workspaceId,
        accessToken: 'stored-access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        invalidatedAt: null,
        ...overrides,
      }) as unknown as IntegrationConnection;

    it.each<[string, Record<string, unknown>]>([
      ['that expires in two minutes', { tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000) }],
      ['that expires in a minute and has no refresh token', { tokenExpiresAt: new Date(Date.now() + 60 * 1000), refreshToken: null }],
      ['without an expiry', { tokenExpiresAt: null }],
    ])('returns the stored token of a connection %s without refreshing', async (_label, overrides) => {
      await expect(service.getValidAccessToken(storedConnection(overrides))).resolves.toBe('stored-access-token');

      expect(tokenEndpoint.requests).toEqual([]);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('reports an expired token that has no refresh token as invalid', async () => {
      const outcome = await service
        .getValidAccessToken(storedConnection({ tokenExpiresAt: new Date(Date.now() - 1000), refreshToken: null }))
        .catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(tokenEndpoint.requests).toEqual([]);
    });

    it('reports a retired connection as invalid', async () => {
      const outcome = await service
        .getValidAccessToken(storedConnection({ invalidatedAt: new Date(), refreshToken: null, tokenExpiresAt: null }))
        .catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(tokenEndpoint.requests).toEqual([]);
    });
  });

  describe('token refresh', () => {
    const refreshBody = (refreshToken: string) =>
      `grant_type=refresh_token&client_id=acme-client-id&client_secret=acme-client-secret&refresh_token=${refreshToken}`;
    const expiringConnection = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'connection-1',
        integrationId: 'integration-acme',
        userId,
        workspaceId,
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: new Date(Date.now() - 1000),
        invalidatedAt: null,
        ...overrides,
      }) as unknown as IntegrationConnection;
    const rejectGrant = (status: number): Reply => (_req, res) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_grant' }));
    };
    // Backs the repo with one row that honours the expected tokens, so a race can be replayed.
    const storeRow = (row: Record<string, unknown>) => {
      const matches = (expected: Record<string, unknown> = {}) =>
        Object.entries(expected).every(([column, value]) => row[column] === value);
      connectionRepo.findById.mockImplementation(async () => ({ ...row }));
      connectionRepo.updateIfTokensMatch.mockImplementation(async (_id, expected, data) => {
        if (!matches(expected)) return false;
        Object.assign(row, data);
        return true;
      });
      connectionRepo.invalidate.mockImplementation(async (_id, expected) => {
        if (matches(expected)) Object.assign(row, { invalidatedAt: new Date(), refreshToken: null, tokenExpiresAt: null });
      });
      return row;
    };
    const reconnectDuring = (reply: Reply, row: Record<string, unknown>): Reply => (req, res) => {
      Object.assign(row, {
        accessToken: 'reconnected-access-token',
        refreshToken: 'reconnected-refresh-token',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      reply(req, res);
    };

    beforeEach(() => {
      connectionRepo.findById.mockResolvedValue(expiringConnection());
    });

    it('stops at a redirecting token endpoint instead of re-POSTing the client secret', async () => {
      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(sink.requests).toEqual([]);
      expect(tokenEndpoint.requests).toHaveLength(1);
      expect(outcome).toBeInstanceOf(BadRequestException);
    });

    it('refreshes using the current row and conditionally stores and returns the new tokens', async () => {
      const row = storeRow({ ...expiringConnection({ refreshToken: 'current-refresh-token' }) });
      tokenEndpointReply = (_req, res) =>
        tokenJson(res, { access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 7200 });

      await expect(service.refreshAccessToken(expiringConnection({ refreshToken: 'stale-refresh-token' })))
        .resolves.toBe('new-access-token');

      expect(tokenEndpoint.requests).toEqual([
        { method: 'POST', url: '/oauth/token', body: refreshBody('current-refresh-token') },
      ]);
      expect(connectionRepo.updateIfTokensMatch).toHaveBeenCalledWith(
        'connection-1', { refreshToken: 'current-refresh-token' }, expect.objectContaining({
          accessToken: 'new-access-token', refreshToken: 'new-refresh-token', invalidatedAt: null,
        }),
      );
      expect(row).toMatchObject({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
      expect(new Date(row.tokenExpiresAt as Date).getTime()).toBeGreaterThan(Date.now() + 7100 * 1000);
    });

    it('drops the refreshed tokens of a connection reconnected during the refresh', async () => {
      const row = storeRow({ ...expiringConnection() });
      tokenEndpointReply = reconnectDuring(
        (_req, res) => tokenJson(res, { access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 7200 }),
        row,
      );

      await expect(service.refreshAccessToken(expiringConnection())).resolves.toBe('reconnected-access-token');

      expect(tokenEndpoint.requests).toHaveLength(1);
      expect(row).toMatchObject({ accessToken: 'reconnected-access-token', refreshToken: 'reconnected-refresh-token' });
    });

    it('repeats the scopes on refresh for a provider that asks for them', async () => {
      connectionRepo.findById.mockResolvedValue(expiringConnection({ integrationId: 'integration-entra' }));
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'new-access-token', expires_in: 3600 });

      await service.refreshAccessToken(expiringConnection({ integrationId: 'integration-entra' }));

      expect(tokenEndpoint.requests.map((r) => r.body)).toEqual([
        'grant_type=refresh_token&client_id=entra-client-id&client_secret=entra-client-secret&refresh_token=refresh-token&scope=api%3A%2F%2Fresource%2Fitems.read+offline_access',
      ]);
    });

    it("refreshes at the provider's own refresh endpoint with HTTP Basic credentials and keeps a refresh token it does not replace", async () => {
      connectionRepo.findById.mockResolvedValue(expiringConnection({ integrationId: 'integration-design' }));
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'new-access-token', expires_in: 7776000 });

      await service.refreshAccessToken(expiringConnection({ integrationId: 'integration-design' }));

      expect(tokenEndpoint.requests).toEqual([
        {
          method: 'POST',
          url: '/oauth/refresh',
          body: 'grant_type=refresh_token&refresh_token=refresh-token',
          authorization: `Basic ${Buffer.from('design-client-id:design-client-secret').toString('base64')}`,
        },
      ]);
      expect(connectionRepo.updateIfTokensMatch).toHaveBeenCalledWith(
        'connection-1',
        { refreshToken: 'refresh-token' },
        expect.objectContaining({ accessToken: 'new-access-token', refreshToken: 'refresh-token' }),
      );
    });

    it.each<[string, Record<string, unknown>]>([
      ['refreshed by a non-rotating provider', { accessToken: 'fresh-access-token' }],
      ['reconnected without a refresh token', { accessToken: 'fresh-access-token', refreshToken: null }],
    ])('skips a connection %s since the caller read it and returns its current token', async (_label, changes) => {
      connectionRepo.findById.mockResolvedValue(
        expiringConnection({ ...changes, tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) }),
      );
      tokenEndpointReply = rejectGrant(400);

      await expect(service.refreshAccessToken(expiringConnection())).resolves.toBe('fresh-access-token');

      expect(tokenEndpoint.requests).toEqual([]);
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
    });

    it.each<[string, Record<string, unknown> | undefined]>([
      ['refreshed to a token that has expired too', { accessToken: 'fresh-access-token', refreshToken: 'rotated-refresh-token' }],
      ['retired', { invalidatedAt: new Date(), refreshToken: null, tokenExpiresAt: null }],
      ['deleted', undefined],
    ])('skips a connection %s since the caller read it and reports it expired', async (_label, changes) => {
      connectionRepo.findById.mockResolvedValue(changes && expiringConnection(changes));
      tokenEndpointReply = rejectGrant(400);

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenExpiredError);
      expect(tokenEndpoint.requests).toEqual([]);
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
    });

    it.each(['acme', 'entra'])('preserves a %s connection reconnected while the old token is rejected', async (type) => {
      const connection = expiringConnection({ integrationId: 'integration-' + type });
      const row = storeRow({ ...connection });
      tokenEndpointReply = reconnectDuring(rejectGrant(400), row);

      await expect(service.refreshAccessToken(connection)).rejects.toBeInstanceOf(TokenInvalidError);

      expect(row).toMatchObject({
        accessToken: 'reconnected-access-token', refreshToken: 'reconnected-refresh-token', invalidatedAt: null,
      });
    });

    it.each<[string, Reply]>([
      ['a 5xx', (_req, res) => {
        res.writeHead(503);
        res.end();
      }],
      ['a dropped connection', (_req, res) => res.socket?.destroy()],
    ])('maps %s from the token endpoint to a failed refresh without invalidating', async (_label, reply) => {
      tokenEndpointReply = reply;

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('Failed to refresh token');
      expect(tokenEndpoint.requests).toHaveLength(1);
      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
    });

    it.each<[string, Record<string, unknown> | null]>([
      ['an access token with a line break', { access_token: 'abc\ndef-SECRET', expires_in: 3600 }],
      ['an access token that is not a string', { access_token: 12345, expires_in: 3600 }],
      ['no access token', { expires_in: 3600 }],
      ['a JSON null', null],
      ['a refresh token with a NUL', { access_token: 'new-access-token', refresh_token: 'abc\x00def-SECRET' }],
    ])('keeps the connection as it was when the refresh returns %s, without logging the token', async (_label, body) => {
      const logged = jest.mocked(Logger.prototype.error);
      logged.mockClear();
      tokenEndpointReply = (_req, res) => tokenJson(res, body);

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('Failed to refresh token');
      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(JSON.stringify(logged.mock.calls)).not.toContain('SECRET');
    });

    it('rejects truncated JSON during refresh without changing the connection or logging the body', async () => {
      const logged = jest.mocked(Logger.prototype.error);
      logged.mockClear();
      tokenEndpointReply = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"access_token":"leaked-0f1e2d3c');
      };

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('Failed to refresh token');
      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(logged.mock.calls).toEqual([
        ['Token refresh for acme returned a response that is not JSON'],
        ['Token refresh error: Token refresh failed'],
      ]);
    });

    it('stops an oversized refresh response without retiring or updating the connection', async () => {
      tokenEndpointReply = (_req, res) => streamUntilClosed(res);

      await expect(service.refreshAccessToken(expiringConnection())).rejects.toBeInstanceOf(BadRequestException);

      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
    }, 5000);

    describe('when the token endpoint rejects the refresh', () => {
      beforeEach(() => {
        jest.mocked(Logger.prototype.error).mockClear();
      });

      it.each([
        [401, 'invalid_client'],
        [400, 'invalid_client'],
        [400, 'unauthorized_client'],
        [400, 'invalid_scope'],
      ])('keeps the connection on %s %s', async (status, error) => {
        storeRow({ ...expiringConnection() });
        tokenEndpointReply = tokenError(status, JSON.stringify({ error, error_description: 'PRIVATE' }));

        await expect(service.getValidAccessToken(expiringConnection())).rejects.toBeInstanceOf(TokenExpiredError);

        expect(connectionRepo.invalidate).not.toHaveBeenCalled();
        expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
        const logs = JSON.stringify(jest.mocked(Logger.prototype.error).mock.calls);
        expect(logs).toContain(status + ' ' + error);
        expect(logs).not.toContain('PRIVATE');
        expect(redis.keys.size).toBe(0);
      });

      it.each(['acme', 'entra'])('retires a %s connection on invalid_grant', async (type) => {
        const connection = expiringConnection({ integrationId: 'integration-' + type });
        const row = storeRow({ ...connection });
        tokenEndpointReply = tokenError(400, JSON.stringify({ error: 'invalid_grant' }));

        await expect(service.getValidAccessToken(connection)).rejects.toBeInstanceOf(TokenInvalidError);

        expect(connectionRepo.invalidate).toHaveBeenCalledWith('connection-1', { refreshToken: 'refresh-token' });
        expect(row).toMatchObject({ invalidatedAt: expect.any(Date), refreshToken: null });
        expect(jest.mocked(Logger.prototype.error).mock.calls).toEqual([[`Token refresh failed for ${type}: 400 invalid_grant`]]);
      });

      it('retires the connection on interaction_required', async () => {
        const row = storeRow({ ...expiringConnection() });
        tokenEndpointReply = tokenError(400, JSON.stringify({ error: 'interaction_required' }));

        await expect(service.getValidAccessToken(expiringConnection())).rejects.toBeInstanceOf(TokenInvalidError);

        expect(connectionRepo.invalidate).toHaveBeenCalledWith('connection-1', { refreshToken: 'refresh-token' });
        expect(row).toMatchObject({ invalidatedAt: expect.any(Date), refreshToken: null });
        expect(redis.keys.size).toBe(0);
      });

      it.each([
        '<html>invalid_grant PRIVATE</html>',
        JSON.stringify({ error: 'invalid_grant\nPRIVATE' }),
        JSON.stringify({ error: 'a'.repeat(41) }),
        JSON.stringify({ error: { code: 'invalid_grant', detail: 'PRIVATE' } }),
      ])('does not retire on a malformed error body: %s', async (body) => {
        connectionRepo.findById.mockResolvedValue(expiringConnection());
        tokenEndpointReply = tokenError(400, body);

        await expect(service.refreshAccessToken(expiringConnection())).rejects.toBeInstanceOf(BadRequestException);

        expect(connectionRepo.invalidate).not.toHaveBeenCalled();
        expect(jest.mocked(Logger.prototype.error).mock.calls).toEqual([
          ['Token refresh failed for acme: 400'], ['Token refresh error: Token refresh failed'],
        ]);
      });
    });

    describe('on the request path', () => {
      const lockKey = 'integration:refresh:connection-1';
      const issueNewTokens: Reply = (_req, res) =>
        tokenJson(res, { access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 7200 });
      const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);

      it.each<[string, Date]>([
        ['has expired', new Date(Date.now() - 1000)],
        ['expires within a minute', new Date(Date.now() + 30 * 1000)],
      ])('refreshes a token that %s and returns the new one', async (_label, tokenExpiresAt) => {
        const row = storeRow({ ...expiringConnection({ tokenExpiresAt }) });
        tokenEndpointReply = issueNewTokens;

        await expect(service.getValidAccessToken(expiringConnection({ tokenExpiresAt }))).resolves.toBe(
          'new-access-token',
        );

        expect(tokenEndpoint.requests.map((r) => r.body)).toEqual([refreshBody('refresh-token')]);
        expect(row).toMatchObject({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
        expect(redis.set).toHaveBeenCalledWith(lockKey, expect.any(String), 'PX', 20_000, 'NX');
        expect(redis.keys.has(lockKey)).toBe(false);
      });

      it('makes one token request for ten concurrent callers', async () => {
        storeRow({ ...expiringConnection() });
        tokenEndpointReply = issueNewTokens;

        const tokens = await Promise.all(
          Array.from({ length: 10 }, () => service.getValidAccessToken(expiringConnection())),
        );

        expect(tokens).toEqual(Array(10).fill('new-access-token'));
        expect(tokenEndpoint.requests).toHaveLength(1);
        expect(redis.set).toHaveBeenCalledTimes(1);
      });

      it('lets a later request refresh after a shared refresh failed', async () => {
        storeRow({ ...expiringConnection() });
        tokenEndpointReply = tokenError(503, '');
        await expect(service.getValidAccessToken(expiringConnection())).rejects.toBeInstanceOf(TokenExpiredError);

        tokenEndpointReply = issueNewTokens;
        await expect(service.getValidAccessToken(expiringConnection())).resolves.toBe('new-access-token');

        expect(tokenEndpoint.requests).toHaveLength(2);
      });

      it('returns the token another process saved after the caller read the row', async () => {
        storeRow({
          ...expiringConnection({
            accessToken: 'saved-access-token',
            refreshToken: 'rotated-refresh-token',
            tokenExpiresAt: inAnHour(),
          }),
        });

        await expect(service.getValidAccessToken(expiringConnection())).resolves.toBe('saved-access-token');

        expect(tokenEndpoint.requests).toEqual([]);
        expect(redis.keys.has(lockKey)).toBe(false);
      });

      it('waits for a refresh another process holds and returns the token it saved', async () => {
        const row = storeRow({ ...expiringConnection() });
        redis.keys.set(lockKey, 'other-process');
        redis.exists.mockImplementationOnce(async () => {
          Object.assign(row, {
            accessToken: 'other-access-token',
            refreshToken: 'other-refresh-token',
            tokenExpiresAt: inAnHour(),
          });
          redis.keys.delete(lockKey);
          return 1;
        });

        await expect(service.getValidAccessToken(expiringConnection())).resolves.toBe('other-access-token');

        expect(redis.exists).toHaveBeenCalledTimes(2);
        expect(tokenEndpoint.requests).toEqual([]);
        expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      });

      it('gives up after five seconds while another process still holds the lock, without retiring the connection', async () => {
        jest.useFakeTimers();
        try {
          const row = storeRow({ ...expiringConnection() });
          redis.keys.set(lockKey, 'other-process');

          const outcome = service.getValidAccessToken(expiringConnection()).catch((err) => err);
          await jest.advanceTimersByTimeAsync(4_800);
          expect(connectionRepo.findById).not.toHaveBeenCalled();
          await jest.advanceTimersByTimeAsync(400);

          expect(await outcome).toBeInstanceOf(TokenExpiredError);
          expect(connectionRepo.findById).toHaveBeenCalledTimes(1);
          expect(tokenEndpoint.requests).toEqual([]);
          expect(connectionRepo.invalidate).not.toHaveBeenCalled();
          expect(row).toMatchObject({ refreshToken: 'refresh-token', invalidatedAt: null });
          expect(redis.keys.get(lockKey)).toBe('other-process');
        } finally {
          jest.useRealTimers();
        }
      });

      it('reports the token expired without refreshing when Redis fails', async () => {
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        storeRow({ ...expiringConnection() });
        redis.set.mockRejectedValue(new Error('connection lost'));
        redis.exists.mockRejectedValue(new Error('connection lost'));
        tokenEndpointReply = issueNewTokens;

        const outcome = await service.getValidAccessToken(expiringConnection()).catch((err) => err);

        expect(outcome).toBeInstanceOf(TokenExpiredError);
        expect(tokenEndpoint.requests).toEqual([]);
        expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
        expect(connectionRepo.invalidate).not.toHaveBeenCalled();
      });
    });
  });
});
