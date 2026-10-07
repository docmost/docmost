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
import { MAX_PROVIDER_RESPONSE_BYTES } from '../utils/provider-fetch';

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

function tokenJson(res: http.ServerResponse, body: Record<string, unknown>) {
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
    while (!res.destroyed && res.write(chunk)) {}
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
            retireOnInvalidGrantOnly: true,
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
    it('audits the install with the provider type', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'issued-access-token' });

      await service.exchangeCodeForTokens('acme', 'auth-code', installState('acme'));

      expect(auditService.log).toHaveBeenCalledWith({
        event: 'integration.installed',
        resourceType: 'integration',
        resourceId: 'integration-acme',
        changes: { after: { provider: 'acme' } },
      });
    });

    it('stores the tokens issued by the token endpoint', async () => {
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

    it('refuses a user who can no longer manage the workspace', async () => {
      currentRole = UserRole.MEMBER;

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', installState('chat')),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tokenEndpoint.requests).toEqual([]);
      expect(connectionRepo.upsertWorkspaceConnection).not.toHaveBeenCalled();
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
    });

    it('refuses a deactivated installer', async () => {
      currentUserDisabledAt = new Date();

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', installState('chat')),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tokenEndpoint.requests).toEqual([]);
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
    });

    it('stops at a redirecting token endpoint instead of re-POSTing the client secret', async () => {
      const outcome = await service
        .exchangeCodeForTokens('acme', 'auth-code', installState('acme'))
        .catch((err) => err);

      expect(sink.requests).toEqual([]);
      expect(tokenEndpoint.requests).toHaveLength(1);
      expect(outcome).toBeInstanceOf(BadRequestException);
    });

    it('fails closed when the token endpoint answers 200 without an access token', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { ok: false, error: 'invalid_code' });

      await expect(
        service.exchangeCodeForTokens('acme', 'auth-code', installState('acme')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
      expect(connectionRepo.upsert).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
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
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'token' });

      const outcome = await service
        .exchangeCodeForTokens('hidden', 'auth-code', installState('hidden'))
        .catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('Unknown integration type: hidden');
      expect(tokenEndpoint.requests).toEqual([]);
      expect(db.transaction).not.toHaveBeenCalled();
      expect(integrationRepo.insertOrRestore).not.toHaveBeenCalled();
      expect(connectionRepo.upsert).not.toHaveBeenCalled();
      expect(connectionRepo.upsertWorkspaceConnection).not.toHaveBeenCalled();
    });
  });

  describe('connect flow', () => {
    it('audits the connect with the provider type', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'user-token' });

      await service.exchangeCodeForTokens('acme', 'auth-code', connectState('integration-acme', 'acme'));

      expect(auditService.log).toHaveBeenCalledWith({
        event: 'integration.connected',
        resourceType: 'integration',
        resourceId: 'integration-acme',
        changes: { after: { provider: 'acme' } },
      });
    });

    it('audits nothing when the code exchange fails', async () => {
      await service
        .exchangeCodeForTokens('acme', 'auth-code', connectState('integration-acme', 'acme'))
        .catch(() => undefined);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('stores a per-user token without touching install state', async () => {
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

    it('links an identity for a workspace-scoped provider and leaves the shared connection alone', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'identity-token' });

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

    it('serves a member without ever reaching the install path', async () => {
      currentRole = UserRole.MEMBER;
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'identity-token' });

      await service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-chat', 'chat'));

      expect(connectionRepo.upsertUserLink).toHaveBeenCalledTimes(1);
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

    it('links when the provider account email matches the Docmost user, ignoring case', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'identity-token' });
      resolveIdentity.mockResolvedValue({ providerUserId: 'U-42', email: 'User@Example.com ' });

      await service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-chat', 'chat'));

      expect(connectionRepo.upsertUserLink).toHaveBeenCalledTimes(1);
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
      expect(errorLog()).toEqual([['Token exchange for acme returned a malformed token']]);
    });

    it.each(malformed)('fails a connect on %s without writing', async (_label, body) => {
      tokenEndpointReply = (_req, res) => tokenJson(res, body);

      await expect(
        service.exchangeCodeForTokens('acme', 'auth-code', connectState('integration-acme', 'acme')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(connectionRepo.upsert).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('fails an identity link on a malformed access token before the provider resolves the identity', async () => {
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'abc\ndef-SECRET' });

      await expect(
        service.exchangeCodeForTokens('chat', 'auth-code', connectState('integration-chat', 'chat')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(resolveIdentity).not.toHaveBeenCalled();
      expect(connectionRepo.upsertUserLink).not.toHaveBeenCalled();
    });

    it('accepts tokens made of any visible ASCII character', async () => {
      const token = Array.from({ length: 94 }, (_, i) => String.fromCharCode(0x21 + i)).join('');
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: token, refresh_token: token });

      const connection = await service.exchangeCodeForTokens(
        'acme',
        'auth-code',
        connectState('integration-acme', 'acme'),
      );

      expect(connection).toMatchObject({ accessToken: token, refreshToken: token });
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
          error_description:
            'AADSTS7000222: The provided client secret keys for app 0f1e2d3c are expired. Trace ID: 4b5a6978 Correlation ID: 8c7d6e5f',
          error_codes: [7000222],
          trace_id: '4b5a6978',
          correlation_id: '8c7d6e5f',
        }),
      );

      const outcome = await exchange('entra');

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('OAuth token exchange failed');
      expect(errorLog()).toEqual([['Token exchange failed for entra: 401 invalid_client']]);
      expectNothingWritten();
    });

    it.each<[string, string]>([
      ['a body that is not JSON', '<html>invalid_grant app 0f1e2d3c</html>'],
      ['an empty body', ''],
      ['an error code in capitals', JSON.stringify({ error: 'INVALID_GRANT' })],
      ['an error code followed by a line break and more text', JSON.stringify({ error: 'invalid_grant\nforged log line' })],
      ['an error code of 41 characters', JSON.stringify({ error: 'a'.repeat(41) })],
      ['an error that is an object', JSON.stringify({ error: { code: 'invalid_grant', app: '0f1e2d3c' } })],
    ])('logs the status only when a refused exchange carries %s', async (_what, body) => {
      tokenEndpointReply = tokenError(400, body);

      const outcome = await exchange();

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(errorLog()).toEqual([['Token exchange failed for acme: 400']]);
    });

    it.each<[string, string, string]>([
      ['an HTML page', 'text/html', '<html><body>Sign in, app 0f1e2d3c</body></html>'],
      ['truncated JSON', 'application/json', '{"access_token":"leaked-0f1e2d3c'],
      ['an empty body', 'application/json', ''],
    ])('fails a 200 carrying %s without quoting it', async (_what, contentType, body) => {
      tokenEndpointReply = (_req, res) => {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(body);
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

  describe('authorization URLs', () => {
    it('install URLs carry an install state', async () => {
      const { authorizationUrl } = await service.getInstallAuthorizationUrl('chat', workspaceId, userId);

      const url = new URL(authorizationUrl);
      expect(`${url.origin}${url.pathname}`).toBe(`${tokenEndpoint.url}/oauth/authorize`);
      expect(decodeState(authorizationUrl)).toMatchObject({ flow: 'install', integrationId: null, type: 'chat' });
    });

    it("install URLs carry the provider's extra authorize params", async () => {
      const { authorizationUrl } = await service.getInstallAuthorizationUrl('chat', workspaceId, userId);

      expect(new URL(authorizationUrl).searchParams.get('prompt')).toBe('consent');
    });

    it("connect URLs carry the provider's extra authorize params without overriding core ones", async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);

      const url = new URL(authorizationUrl);
      expect(url.searchParams.get('audience')).toBe('api.acme.test');
      expect(url.searchParams.getAll('client_id')).toEqual(['acme-client-id']);
    });

    it("identity connect URLs use the identity's params, not the provider's", async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-chat', workspaceId, userId);

      expect(new URL(authorizationUrl).searchParams.has('prompt')).toBe(false);
    });

    it('connect URLs for a workspace-scoped provider use the identity flow', async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-chat', workspaceId, userId);

      const url = new URL(authorizationUrl);
      expect(`${url.origin}${url.pathname}`).toBe(`${tokenEndpoint.url}/openid/authorize`);
      expect(url.searchParams.get('team')).toBe('T-1');
      expect(url.searchParams.get('scope')).toBe('openid profile');
      expect(url.searchParams.get('client_id')).toBe('chat-client-id');
      expect(decodeState(authorizationUrl)).toMatchObject({
        flow: 'connect',
        integrationId: 'integration-chat',
        returnPath: '/settings/account/connections',
      });
    });

    it('connect URLs for a per-user provider use the provider token flow', async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);

      const url = new URL(authorizationUrl);
      expect(`${url.origin}${url.pathname}`).toBe(`${tokenEndpoint.url}/oauth/authorize`);
      expect(url.searchParams.get('scope')).toBe('read');
      expect(decodeState(authorizationUrl)).toMatchObject({ flow: 'connect', integrationId: 'integration-acme' });
    });

    it('refuses connect URLs for a workspace-scoped provider without an identity flow', async () => {
      await expect(
        service.getAuthorizationUrl('integration-legacy', workspaceId, userId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('connect URLs sign the nonce they return for the browser cookie', async () => {
      const first = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);
      const second = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);

      expect(first.type).toBe('acme');
      expect(first.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(decodeState(first.authorizationUrl).nonce).toBe(first.nonce);
      expect(second.nonce).not.toBe(first.nonce);
    });

    it('install URLs sign the nonce they return for the browser cookie', async () => {
      const { authorizationUrl, nonce } = await service.getInstallAuthorizationUrl('chat', workspaceId, userId);

      expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(decodeState(authorizationUrl).nonce).toBe(nonce);
    });

    it('refuses install URLs for a hidden provider as an unknown type', async () => {
      const createSignedState = jest.spyOn(service as any, 'createSignedState');

      const outcome = await service
        .getInstallAuthorizationUrl('hidden', workspaceId, userId)
        .catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('Unknown integration type: hidden');
      expect(integrationRepo.findByWorkspaceAndType).not.toHaveBeenCalled();
      expect(createSignedState).not.toHaveBeenCalled();
    });

    it('connect URLs still work for an existing installation of a hidden provider', async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-hidden', workspaceId, userId);

      expect(decodeState(authorizationUrl)).toMatchObject({ flow: 'connect', integrationId: 'integration-hidden' });
    });
  });

  describe('signed state', () => {
    const signedState = async () => {
      const { authorizationUrl } = await service.getAuthorizationUrl('integration-acme', workspaceId, userId);
      return new URL(authorizationUrl).searchParams.get('state') ?? '';
    };

    it('round-trips a valid signed state', async () => {
      const state = await signedState();

      expect(service.verifySignedState(state)).toMatchObject({
        flow: 'connect',
        integrationId: 'integration-acme',
        type: 'acme',
        userId,
        workspaceId,
      });
    });

    it('refuses a state with a tampered signature', async () => {
      const state = await signedState();
      const dotIndex = state.lastIndexOf('.');
      const signature = state.substring(dotIndex + 1);
      const tampered = (signature[0] === 'A' ? 'B' : 'A') + signature.substring(1);

      expect(service.verifySignedState(`${state.substring(0, dotIndex)}.${tampered}`)).toBeNull();
    });

    it('refuses a signature of a different length without throwing', async () => {
      const state = await signedState();

      expect(() => service.verifySignedState(`${state}A`)).not.toThrow();
      expect(service.verifySignedState(`${state}A`)).toBeNull();
      expect(service.verifySignedState(state.slice(0, -1))).toBeNull();
    });

    it('refuses a state without a signature separator', async () => {
      const state = await signedState();

      expect(service.verifySignedState(state.replace('.', ''))).toBeNull();
    });

    it('refuses a state signed with the raw app secret', async () => {
      const state = await signedState();
      const data = state.substring(0, state.lastIndexOf('.'));
      const rawSignature = crypto
        .createHmac('sha256', 'test-secret')
        .update(data)
        .digest('base64url');

      expect(service.verifySignedState(`${data}.${rawSignature}`)).toBeNull();
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
      ['that expires in an hour', {}],
      ['that expires in two minutes', { tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000) }],
      ['that expires in a minute and has no refresh token', { tokenExpiresAt: new Date(Date.now() + 60 * 1000), refreshToken: null }],
      ['without an expiry', { tokenExpiresAt: null }],
      ['without an expiry or a refresh token', { tokenExpiresAt: null, refreshToken: null }],
    ])('returns the stored token of a connection %s without refreshing', async (_label, overrides) => {
      await expect(service.getValidAccessToken(storedConnection(overrides))).resolves.toBe('stored-access-token');

      expect(tokenEndpoint.requests).toEqual([]);
      expect(connectionRepo.findById).not.toHaveBeenCalled();
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
      expect(redis.exists).not.toHaveBeenCalled();
      expect(redis.eval).not.toHaveBeenCalled();
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

    it('saves the new tokens on the condition that the row still holds the refresh token it sent', async () => {
      tokenEndpointReply = (_req, res) =>
        tokenJson(res, { access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 7200 });

      await service.refreshAccessToken(expiringConnection());

      expect(connectionRepo.findById).toHaveBeenCalledWith('connection-1');
      expect(tokenEndpoint.requests).toEqual([
        { method: 'POST', url: '/oauth/token', body: refreshBody('refresh-token') },
      ]);
      expect(connectionRepo.updateIfTokensMatch).toHaveBeenCalledWith(
        'connection-1',
        { refreshToken: 'refresh-token' },
        expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          invalidatedAt: null,
        }),
      );
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('stores the refreshed tokens in the row and returns the new access token', async () => {
      const row = storeRow({ ...expiringConnection() });
      tokenEndpointReply = (_req, res) =>
        tokenJson(res, { access_token: 'new-access-token', refresh_token: 'new-refresh-token', expires_in: 7200 });

      await expect(service.refreshAccessToken(expiringConnection())).resolves.toBe('new-access-token');

      expect(row).toMatchObject({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token', invalidatedAt: null });
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

    it("presents the stored row's refresh token rather than the caller's snapshot", async () => {
      connectionRepo.findById.mockResolvedValue(expiringConnection({ refreshToken: 'current-refresh-token' }));
      tokenEndpointReply = (_req, res) => tokenJson(res, { access_token: 'new-access-token', expires_in: 7200 });

      await service.refreshAccessToken(expiringConnection({ refreshToken: 'stale-refresh-token' }));

      expect(tokenEndpoint.requests.map((r) => r.body)).toEqual([refreshBody('current-refresh-token')]);
      expect(connectionRepo.updateIfTokensMatch).toHaveBeenCalledWith(
        'connection-1',
        { refreshToken: 'current-refresh-token' },
        expect.objectContaining({ refreshToken: 'current-refresh-token' }),
      );
    });

    it.each<[string, Record<string, unknown>]>([
      ['refreshed by a rotating provider', { accessToken: 'fresh-access-token', refreshToken: 'rotated-refresh-token' }],
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

    it.each([400, 401])('retires the connection when the token endpoint answers %s', async (status) => {
      const row = storeRow({ ...expiringConnection() });
      tokenEndpointReply = rejectGrant(status);

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(connectionRepo.invalidate).toHaveBeenCalledWith('connection-1', { refreshToken: 'refresh-token' });
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(row).toMatchObject({ invalidatedAt: expect.any(Date), refreshToken: null });
    });

    it('keeps a connection reconnected while its old refresh token was being rejected', async () => {
      const row = storeRow({ ...expiringConnection() });
      tokenEndpointReply = reconnectDuring(rejectGrant(400), row);

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(row).toMatchObject({
        accessToken: 'reconnected-access-token',
        refreshToken: 'reconnected-refresh-token',
        invalidatedAt: null,
      });
    });

    it.each([400, 401])('retires on a %s whatever the error code, and logs the status only, by default', async (status) => {
      const logged = jest.mocked(Logger.prototype.error);
      logged.mockClear();
      tokenEndpointReply = (_req, res) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client', error_description: 'AADSTS7000222: the client secret expired' }));
      };

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(TokenInvalidError);
      expect(connectionRepo.invalidate).toHaveBeenCalledWith('connection-1', { refreshToken: 'refresh-token' });
      expect(logged.mock.calls).toEqual([[`Token refresh failed for acme: ${status}`]]);
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

    it.each<[string, Record<string, unknown>]>([
      ['an access token with a line break', { access_token: 'abc\ndef-SECRET', expires_in: 3600 }],
      ['an access token that is not a string', { access_token: 12345, expires_in: 3600 }],
      ['no access token', { expires_in: 3600 }],
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
      expect(logged.mock.calls).toEqual([
        ['Token refresh for acme returned a malformed token'],
        ['Token refresh error: Token refresh failed'],
      ]);
    });

    it.each<[string, string, string]>([
      ['an HTML page', 'text/html', '<html><body>Sign in, app 0f1e2d3c</body></html>'],
      ['truncated JSON', 'application/json', '{"access_token":"leaked-0f1e2d3c'],
      ['a JSON null', 'application/json', 'null'],
    ])('keeps the connection as it was when a 200 carries %s, without quoting it', async (_what, contentType, body) => {
      const logged = jest.mocked(Logger.prototype.error);
      logged.mockClear();
      tokenEndpointReply = (_req, res) => {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(body);
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

    it.each<[string, Reply]>([
      ['declares a length over the cap', (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': String(MAX_PROVIDER_RESPONSE_BYTES + 1),
        });
        res.write('{"access_token":"');
      }],
      ['streams past the cap', (_req, res) => streamUntilClosed(res)],
    ])('fails a refresh whose response %s without reading on or retiring the connection', async (_what, reply) => {
      const logged = jest.mocked(Logger.prototype.error);
      logged.mockClear();
      tokenEndpointReply = reply;

      const outcome = await service.refreshAccessToken(expiringConnection()).catch((err) => err);

      expect(outcome).toBeInstanceOf(BadRequestException);
      expect(outcome.message).toBe('Failed to refresh token');
      expect(connectionRepo.invalidate).not.toHaveBeenCalled();
      expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
      expect(logged.mock.calls).toEqual([
        ['Token refresh error: acme token endpoint API error: 502 response too large'],
      ]);
    }, 5000);

    describe('for a provider that retires on invalid_grant only', () => {
      const entraConnection = () => expiringConnection({ integrationId: 'integration-entra' });
      const errorLog = () => jest.mocked(Logger.prototype.error).mock.calls;

      beforeEach(() => {
        connectionRepo.findById.mockResolvedValue(entraConnection());
        jest.mocked(Logger.prototype.error).mockClear();
      });

      it.each([
        [401, 'invalid_client'],
        [400, 'invalid_request'],
        [400, 'invalid_scope'],
        [400, 'unauthorized_client'],
        [400, 'a'.repeat(40)],
      ])('keeps the connection and fails the refresh on a %s %s', async (status, error) => {
        tokenEndpointReply = tokenError(status, JSON.stringify({ error }));

        const outcome = await service.refreshAccessToken(entraConnection()).catch((err) => err);

        expect(outcome).toBeInstanceOf(BadRequestException);
        expect(outcome.message).toBe('Failed to refresh token');
        expect(tokenEndpoint.requests).toHaveLength(1);
        expect(connectionRepo.invalidate).not.toHaveBeenCalled();
        expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
        expect(errorLog()).toEqual([
          [`Token refresh failed for entra: ${status} ${error}`],
          ['Token refresh error: Token refresh failed'],
        ]);
      });

      it.each(['invalid_grant', 'interaction_required'])('retires the connection on a 400 %s', async (error) => {
        tokenEndpointReply = tokenError(400, JSON.stringify({ error }));

        const outcome = await service.refreshAccessToken(entraConnection()).catch((err) => err);

        expect(outcome).toBeInstanceOf(TokenInvalidError);
        expect(connectionRepo.invalidate).toHaveBeenCalledWith('connection-1', { refreshToken: 'refresh-token' });
        expect(connectionRepo.updateIfTokensMatch).not.toHaveBeenCalled();
        expect(errorLog()).toEqual([[`Token refresh failed for entra: 400 ${error}`]]);
      });

      it('keeps a connection reconnected while its old refresh token was being rejected', async () => {
        const row = storeRow({ ...entraConnection() });
        tokenEndpointReply = reconnectDuring(tokenError(400, JSON.stringify({ error: 'invalid_grant' })), row);

        const outcome = await service.refreshAccessToken(entraConnection()).catch((err) => err);

        expect(outcome).toBeInstanceOf(TokenInvalidError);
        expect(row).toMatchObject({ refreshToken: 'reconnected-refresh-token', invalidatedAt: null });
      });

      it.each<[string, string]>([
        ['a body that is not JSON', '<html>invalid_grant</html>'],
        ['an empty body', ''],
        ['a JSON null', 'null'],
        ['a JSON string', JSON.stringify('invalid_grant')],
        ['no error field', JSON.stringify({ code: 'invalid_grant', message: 'invalid_grant' })],
        ['an error code in capitals', JSON.stringify({ error: 'INVALID_GRANT' })],
        ['an error code followed by a space', JSON.stringify({ error: 'invalid_grant ' })],
        ['an error code followed by a line break and more text', JSON.stringify({ error: 'invalid_grant\nforged log line' })],
        ['an error code of 41 characters', JSON.stringify({ error: 'a'.repeat(41) })],
        ['an error that is a list', JSON.stringify({ error: ['invalid_grant'] })],
        ['an error that is an object', JSON.stringify({ error: { code: 'invalid_grant' } })],
      ])('keeps the connection and logs the status only when a 400 carries %s', async (_what, body) => {
        tokenEndpointReply = tokenError(400, body);

        const outcome = await service.refreshAccessToken(entraConnection()).catch((err) => err);

        expect(outcome).toBeInstanceOf(BadRequestException);
        expect(outcome.message).toBe('Failed to refresh token');
        expect(connectionRepo.invalidate).not.toHaveBeenCalled();
        expect(errorLog()).toEqual([
          ['Token refresh failed for entra: 400'],
          ['Token refresh error: Token refresh failed'],
        ]);
      });

      it('logs the error code and nothing else from the response', async () => {
        tokenEndpointReply = tokenError(
          401,
          JSON.stringify({
            error: 'invalid_client',
            error_description:
              'AADSTS7000222: The provided client secret keys for app 0f1e2d3c are expired. Trace ID: 4b5a6978 Correlation ID: 8c7d6e5f',
            error_codes: [7000222],
            trace_id: '4b5a6978',
            correlation_id: '8c7d6e5f',
            error_uri: 'https://login.microsoftonline.com/error?code=7000222',
          }),
        );

        await service.refreshAccessToken(entraConnection()).catch((err) => err);

        expect(errorLog()).toEqual([
          ['Token refresh failed for entra: 401 invalid_client'],
          ['Token refresh error: Token refresh failed'],
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

      it.each<[string, string, Reply]>([
        ['a 5xx', 'integration-acme', tokenError(503, '')],
        ['a dropped connection', 'integration-acme', (_req, res) => res.socket?.destroy()],
        [
          'a refused client on a provider that retires on invalid_grant only',
          'integration-entra',
          tokenError(401, JSON.stringify({ error: 'invalid_client' })),
        ],
      ])('reports %s from the token endpoint as expired and keeps the connection', async (_label, integrationId, reply) => {
        const row = storeRow({ ...expiringConnection({ integrationId }) });
        tokenEndpointReply = reply;

        const outcome = await service.getValidAccessToken(expiringConnection({ integrationId })).catch((err) => err);

        expect(outcome).toBeInstanceOf(TokenExpiredError);
        expect(tokenEndpoint.requests).toHaveLength(1);
        expect(connectionRepo.invalidate).not.toHaveBeenCalled();
        expect(row).toMatchObject({ accessToken: 'expired-access-token', refreshToken: 'refresh-token', invalidatedAt: null });
        expect(redis.keys.has(lockKey)).toBe(false);
      });

      it.each<[string, string]>([
        ['the provider', 'integration-acme'],
        ['a provider that retires on invalid_grant only', 'integration-entra'],
      ])('retires the connection when %s answers invalid_grant', async (_label, integrationId) => {
        const row = storeRow({ ...expiringConnection({ integrationId }) });
        tokenEndpointReply = rejectGrant(400);

        const outcome = await service.getValidAccessToken(expiringConnection({ integrationId })).catch((err) => err);

        expect(outcome).toBeInstanceOf(TokenInvalidError);
        expect(connectionRepo.invalidate).toHaveBeenCalledWith('connection-1', { refreshToken: 'refresh-token' });
        expect(row).toMatchObject({ invalidatedAt: expect.any(Date), refreshToken: null });
        expect(redis.keys.has(lockKey)).toBe(false);
      });
    });
  });
});
