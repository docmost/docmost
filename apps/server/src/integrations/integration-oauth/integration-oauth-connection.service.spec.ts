import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationOauthConnection } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../environment/environment.service';
import { IntegrationOAuthConnectionRepo } from './integration-oauth-connection.repo';
import { IntegrationOAuthConnectionService } from './integration-oauth-connection.service';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationManifest } from './manifest.types';
import { outboundFetch } from './outbound-url-guard';

jest.mock('./outbound-url-guard', () => {
  const actual = jest.requireActual('./outbound-url-guard');
  return {
    ...actual,
    assertAllowedOutboundUrl: jest.fn().mockResolvedValue(undefined),
    outboundFetch: jest.fn(),
    readOutboundBody: jest.fn((resp: { __body?: string }) =>
      Promise.resolve(resp.__body ?? ''),
    ),
  };
});

const outboundFetchMock = outboundFetch as jest.MockedFunction<
  typeof outboundFetch
>;

function fakeResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    __body: JSON.stringify(body),
  } as never;
}

function row(
  overrides: Partial<IntegrationOauthConnection> = {},
): IntegrationOauthConnection {
  return {
    id: 'connection-1',
    integrationId: 'windshift:connection-1',
    workspaceId: 'workspace-1',
    enabled: true,
    baseUrl: 'https://windshift.example',
    oauthClientId: 'wsoc_existing',
    oauthClientSecretEncrypted: null,
    settings: {},
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IntegrationOauthConnection;
}

describe('IntegrationOAuthConnectionService', () => {
  let registry: IntegrationOAuthRegistry;
  let repo: {
    find: jest.Mock;
    listByWorkspace: jest.Mock;
    upsert: jest.Mock;
  };
  let service: IntegrationOAuthConnectionService;

  function buildService(manifestOverrides: Partial<IntegrationManifest> = {}) {
    registry = new IntegrationOAuthRegistry();
    registry.register({
      id: 'windshift',
      name: 'Windshift',
      baseUrl: () => '',
      authorizePath: '/oauth/authorize',
      tokenPath: '/api/oauth/token',
      scopes: ['items:read', 'workspaces:read', 'collections:read'],
      scopeSeparator: ' ',
      pkce: true,
      dynamicClientRegistration: {
        path: '/api/oauth/register',
        clientName: 'Docmost Windshift',
      },
      clientIdEnv: 'WINDSHIFT_OAUTH_CLIENT_ID',
      ...manifestOverrides,
    });
    repo = {
      find: jest.fn().mockResolvedValue(undefined),
      listByWorkspace: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(async (input) => row(input)),
    };
    service = new IntegrationOAuthConnectionService(
      registry,
      repo as unknown as IntegrationOAuthConnectionRepo,
      {
        getAppUrl: () => 'https://docmost.example',
        getAppSecret: () => 'test-app-secret-with-enough-entropy',
      } as unknown as EnvironmentService,
      { get: () => undefined } as unknown as ConfigService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    buildService();
  });

  it('registers and persists a public client when saving a dynamic provider', async () => {
    outboundFetchMock.mockResolvedValue(
      fakeResponse(201, { client_id: 'wsoc_registered' }),
    );

    const result = await service.save(
      'workspace-1',
      'windshift:connection-1',
      'user-1',
      {
        baseUrl: 'https://windshift.example/',
        enabled: true,
        settings: {},
      },
    );

    expect(outboundFetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = outboundFetchMock.mock.calls[0];
    expect(url).toBe('https://windshift.example/api/oauth/register');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    });
    expect(JSON.parse(init!.body as string)).toEqual({
      client_name: 'Docmost Windshift',
      redirect_uris: [
        'https://docmost.example/api/integrations/oauth/windshift%3Aconnection-1/callback',
      ],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'items:read workspaces:read collections:read',
    });
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        oauthClientId: 'wsoc_registered',
        oauthClientSecretEncrypted: null,
      }),
    );
    expect(result).toMatchObject({
      oauthClientId: 'wsoc_registered',
      hasClientSecret: false,
      automaticClientRegistration: true,
    });
  });

  it('reuses the existing public client while the provider base URL is unchanged', async () => {
    repo.find.mockResolvedValue(row());

    await service.save('workspace-1', 'windshift:connection-1', 'user-1', {
      baseUrl: 'https://windshift.example',
      enabled: true,
    });

    expect(outboundFetchMock).not.toHaveBeenCalled();
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        oauthClientId: 'wsoc_existing',
        oauthClientSecretEncrypted: null,
      }),
    );
  });

  it('does not persist a connection when dynamic registration fails', async () => {
    outboundFetchMock.mockResolvedValue(
      fakeResponse(400, { error: 'invalid_client_metadata' }),
    );

    await expect(
      service.save('workspace-1', 'windshift:connection-1', 'user-1', {
        baseUrl: 'https://windshift.example',
        enabled: true,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Could not register an OAuth client with Windshift: registration endpoint returned 400',
      ),
    );
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('still requires an explicit client ID for manually configured providers', async () => {
    buildService({ dynamicClientRegistration: undefined });

    await expect(
      service.save('workspace-1', 'windshift:connection-1', 'user-1', {
        baseUrl: 'https://windshift.example',
      }),
    ).rejects.toThrow('OAuth client ID is required');
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
