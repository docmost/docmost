import * as crypto from 'crypto';
import { UnfurlService } from './unfurl.service';
import { IntegrationRegistry } from '../registry/integration-registry';
import { GitHubProvider } from '../providers/github/github.provider';
import {
  IntegrationDefinition,
  IntegrationProvider,
  TokenExpiredError,
  TokenInvalidError,
} from '../registry/integration-provider.interface';

const GHE_BASE = 'https://github.acme.com';
const CONNECTED_AT = new Date('2026-10-01T09:00:00Z');

class WorkspaceScopedProvider extends IntegrationProvider {
  definition: IntegrationDefinition = {
    type: 'chat',
    name: 'Chat',
    description: '',
    icon: '',
    capabilities: ['unfurl'],
    oauth: { authUrl: '', tokenUrl: '', scopes: [], connectionScope: 'workspace' },
    unfurlPatterns: [{ regex: /^https:\/\/chat\.example\/m\/(\w+)$/, type: 'message' }],
  };
  unfurl = jest.fn().mockResolvedValue({ title: 'Message' });
}

function build() {
  const unfurlPullRequest = jest.fn().mockResolvedValue({ title: 'PR' });
  const registry = new IntegrationRegistry();
  registry.register(new GitHubProvider({ unfurlPullRequest } as any));

  const integration = { id: 'i1', type: 'github', settings: {} };
  const integrationRepo = {
    findByWorkspaceAndType: jest.fn().mockResolvedValue(integration),
    findAllByWorkspace: jest.fn().mockResolvedValue([integration]),
  };
  const connectionRepo = {
    findByIntegrationAndUser: jest
      .fn()
      .mockResolvedValue({ id: 'c1', invalidatedAt: null, updatedAt: CONNECTED_AT }),
    findWorkspaceConnection: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
  const oauthService = {
    getValidAccessToken: jest.fn().mockResolvedValue('token'),
  };
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const service = new UnfurlService(
    registry,
    integrationRepo as any,
    connectionRepo as any,
    oauthService as any,
    { getOrThrow: () => redis } as any,
  );
  return {
    service,
    registry,
    unfurlPullRequest,
    integrationRepo,
    connectionRepo,
    oauthService,
    redis,
  };
}

describe('UnfurlService provider resolution', () => {
  const original = process.env.INTEGRATION_GITHUB_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_GITHUB_URL;
    else process.env.INTEGRATION_GITHUB_URL = original;
  });

  it('returns null for github.com links when GitHub Enterprise is configured', async () => {
    process.env.INTEGRATION_GITHUB_URL = GHE_BASE;
    const { service, unfurlPullRequest, connectionRepo } = build();

    await expect(
      service.unfurl('https://github.com/o/r/pull/1', 'u1', 'w1'),
    ).resolves.toBeNull();
    expect(connectionRepo.findByIntegrationAndUser).not.toHaveBeenCalled();
    expect(connectionRepo.invalidate).not.toHaveBeenCalled();
    expect(unfurlPullRequest).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 'https://github.com/o/r/pull/1', 'https://api.github.com'],
    [GHE_BASE, `${GHE_BASE}/o/r/pull/1`, `${GHE_BASE}/api/v3`],
  ])(
    'resolves links on the configured host (%s) through the installed integration',
    async (configured, url, apiBaseUrl) => {
      if (configured === undefined) delete process.env.INTEGRATION_GITHUB_URL;
      else process.env.INTEGRATION_GITHUB_URL = configured;
      const { service, unfurlPullRequest } = build();

      await expect(service.unfurl(url, 'u1', 'w1')).resolves.toEqual({
        title: 'PR',
      });
      expect(unfurlPullRequest).toHaveBeenCalledWith(
        'token', apiBaseUrl, 'o', 'r', 1, url,
      );
    },
  );
});

describe('UnfurlService credential failures', () => {
  const original = process.env.INTEGRATION_GITHUB_URL;
  const url = 'https://github.com/o/r/pull/1';

  beforeEach(() => {
    delete process.env.INTEGRATION_GITHUB_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_GITHUB_URL;
    else process.env.INTEGRATION_GITHUB_URL = original;
  });

  it('shows no card for a token awaiting refresh, without caching or retiring', async () => {
    const { service, unfurlPullRequest, connectionRepo, oauthService, redis } =
      build();
    oauthService.getValidAccessToken.mockRejectedValue(new TokenExpiredError());

    await expect(service.unfurl(url, 'u1', 'w1')).resolves.toBeNull();

    expect(unfurlPullRequest).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(connectionRepo.invalidate).not.toHaveBeenCalled();
  });

  describe('when the provider rejects the token', () => {
    function buildWithStoredRow() {
      const built = build();
      const row: Record<string, unknown> = {
        id: 'c1',
        invalidatedAt: null,
        updatedAt: CONNECTED_AT,
        accessToken: 'used-access-token',
      };
      built.connectionRepo.findByIntegrationAndUser.mockImplementation(
        async () => ({ ...row }),
      );
      built.connectionRepo.invalidate.mockImplementation(
        async (_id: string, expected: Record<string, unknown> = {}) => {
          const matches = Object.entries(expected).every(
            ([column, value]) => row[column] === value,
          );
          if (matches) row.invalidatedAt = new Date();
        },
      );
      return { ...built, row };
    }

    it('retires a connection that still holds the rejected token', async () => {
      const { service, unfurlPullRequest, connectionRepo, row } =
        buildWithStoredRow();
      unfurlPullRequest.mockRejectedValue(new TokenInvalidError());

      await expect(service.unfurl(url, 'u1', 'w1')).resolves.toMatchObject({
        needsConnection: true,
      });

      expect(connectionRepo.invalidate).toHaveBeenCalledWith('c1', {
        accessToken: 'used-access-token',
      });
      expect(row.invalidatedAt).toBeInstanceOf(Date);
    });

    it('keeps a connection whose token the refresh job replaced after it was read', async () => {
      const { service, unfurlPullRequest, row } = buildWithStoredRow();
      unfurlPullRequest.mockImplementation(async () => {
        row.accessToken = 'refreshed-access-token';
        throw new TokenInvalidError();
      });

      await service.unfurl(url, 'u1', 'w1');

      expect(unfurlPullRequest).toHaveBeenCalledTimes(1);
      expect(row.invalidatedAt).toBeNull();
    });
  });
});

describe('UnfurlService cache', () => {
  const original = process.env.INTEGRATION_GITHUB_URL;
  const url = 'https://github.com/o/r/pull/1';
  const urlDigest = crypto.createHash('sha256').update(url).digest('hex');
  const cachedCard = JSON.stringify({ title: 'Cached PR' });

  beforeEach(() => {
    delete process.env.INTEGRATION_GITHUB_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_GITHUB_URL;
    else process.env.INTEGRATION_GITHUB_URL = original;
  });

  it('serves a cached card only after finding the connection', async () => {
    const { service, unfurlPullRequest, connectionRepo, redis } = build();
    redis.get.mockResolvedValue(cachedCard);

    await expect(service.unfurl(url, 'u1', 'w1')).resolves.toEqual({
      title: 'Cached PR',
    });

    expect(unfurlPullRequest).not.toHaveBeenCalled();
    expect(
      connectionRepo.findByIntegrationAndUser.mock.invocationCallOrder[0],
    ).toBeLessThan(redis.get.mock.invocationCallOrder[0]);
  });

  it('asks a disconnected member to connect instead of serving their cached card', async () => {
    const { service, connectionRepo, redis } = build();
    redis.get.mockResolvedValue(cachedCard);
    connectionRepo.findByIntegrationAndUser.mockResolvedValue(undefined);

    await expect(service.unfurl(url, 'u1', 'w1')).resolves.toMatchObject({
      needsConnection: true,
    });

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('serves no cached card once the integration is uninstalled', async () => {
    const { service, integrationRepo, connectionRepo, redis } = build();
    redis.get.mockResolvedValue(cachedCard);
    integrationRepo.findByWorkspaceAndType.mockResolvedValue(undefined);
    integrationRepo.findAllByWorkspace.mockResolvedValue([]);

    await expect(service.unfurl(url, 'u1', 'w1')).resolves.toBeNull();

    expect(connectionRepo.findByIntegrationAndUser).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('keys the card by connection, its last update and the full URL digest', async () => {
    const { service, redis } = build();

    await service.unfurl(url, 'u1', 'w1');

    expect(urlDigest).toHaveLength(64);
    expect(redis.get).toHaveBeenCalledWith(
      `unfurl:w1:u1:c1:${CONNECTED_AT.getTime()}:${urlDigest}`,
    );
    expect(redis.set).toHaveBeenCalledWith(
      `unfurl:w1:u1:c1:${CONNECTED_AT.getTime()}:${urlDigest}`,
      JSON.stringify({ title: 'PR' }),
      'EX',
      300,
    );
  });

  it('refetches once the connection is updated by a reconnect or refresh', async () => {
    const { service, unfurlPullRequest, connectionRepo, redis } = build();
    const store = new Map<string, string>();
    redis.get.mockImplementation(async (key: string) => store.get(key) ?? null);
    redis.set.mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    });

    await service.unfurl(url, 'u1', 'w1');
    await service.unfurl(url, 'u1', 'w1');
    expect(unfurlPullRequest).toHaveBeenCalledTimes(1);

    connectionRepo.findByIntegrationAndUser.mockResolvedValue({
      id: 'c1',
      invalidatedAt: null,
      updatedAt: new Date(CONNECTED_AT.getTime() + 1000),
    });
    await service.unfurl(url, 'u1', 'w1');

    expect(unfurlPullRequest).toHaveBeenCalledTimes(2);
  });

  describe('for a workspace-scoped provider', () => {
    const messageUrl = 'https://chat.example/m/abc';

    function buildWorkspaceScoped() {
      const built = build();
      const provider = new WorkspaceScopedProvider();
      built.registry.register(provider);
      const integration = { id: 'i2', type: 'chat', settings: {} };
      built.integrationRepo.findByWorkspaceAndType.mockResolvedValue(integration);
      built.integrationRepo.findAllByWorkspace.mockResolvedValue([integration]);
      return { ...built, provider };
    }

    it('serves no cached card once the workspace connection is gone', async () => {
      const { service, provider, connectionRepo, redis } =
        buildWorkspaceScoped();
      redis.get.mockResolvedValue(cachedCard);

      await expect(service.unfurl(messageUrl, 'u1', 'w1')).resolves.toBeNull();

      expect(connectionRepo.findWorkspaceConnection).toHaveBeenCalledWith('i2');
      expect(redis.get).not.toHaveBeenCalled();
      expect(provider.unfurl).not.toHaveBeenCalled();
    });

    it('keeps the viewer in the key of the shared connection', async () => {
      const { service, connectionRepo, redis } = buildWorkspaceScoped();
      connectionRepo.findWorkspaceConnection.mockResolvedValue({
        id: 'wc1',
        invalidatedAt: null,
        updatedAt: CONNECTED_AT,
      });

      await service.unfurl(messageUrl, 'u1', 'w1');

      const digest = crypto.createHash('sha256').update(messageUrl).digest('hex');
      expect(redis.get).toHaveBeenCalledWith(
        `unfurl:w1:u1:wc1:${CONNECTED_AT.getTime()}:${digest}`,
      );
    });
  });
});
