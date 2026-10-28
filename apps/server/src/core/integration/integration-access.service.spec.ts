import {
  IntegrationAccessService,
  IntegrationNeedsConnectionError,
  IntegrationNotInstalledError,
} from './integration-access.service';
import {
  TokenExpiredError,
  TokenInvalidError,
} from './registry/integration-provider.interface';

const provider = {
  definition: {
    type: 'microsoft_365',
    name: 'Microsoft 365',
    oauth: { authUrl: 'a', tokenUrl: 't', scopes: [] },
  },
};

function build(overrides: Partial<{
  integration: any;
  connection: any;
  token: () => Promise<string>;
}> = {}) {
  const integrationRepo = {
    findByWorkspaceAndType: jest.fn().mockResolvedValue(
      'integration' in overrides ? overrides.integration : { id: 'int-1', type: 'microsoft_365', settings: null },
    ),
  };
  const connectionRepo = {
    findByIntegrationAndUser: jest.fn().mockResolvedValue(
      'connection' in overrides
        ? overrides.connection
        : { id: 'conn-1', kind: 'user', accessToken: 'enc', invalidatedAt: null },
    ),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
  const oauthService = {
    getValidAccessToken: jest.fn(overrides.token ?? (() => Promise.resolve('plain-token'))),
  };
  const registry = { getProvider: jest.fn().mockReturnValue(provider) };
  const service = new IntegrationAccessService(
    registry as any,
    integrationRepo as any,
    connectionRepo as any,
    oauthService as any,
  );
  return { service, integrationRepo, connectionRepo, oauthService };
}

describe('IntegrationAccessService.getUserAccess', () => {
  it('returns the integration, connection and a valid token', async () => {
    const { service } = build();
    const access = await service.getUserAccess('microsoft_365', 'user-1', 'ws-1');
    expect(access.accessToken).toBe('plain-token');
    expect(access.integration.id).toBe('int-1');
    expect(access.connection.id).toBe('conn-1');
  });

  it('throws not-installed when the workspace has no integration row', async () => {
    const { service } = build({ integration: undefined });
    await expect(service.getUserAccess('microsoft_365', 'user-1', 'ws-1')).rejects.toBeInstanceOf(
      IntegrationNotInstalledError,
    );
  });

  it('throws needs-connection with connect details when the user has no row', async () => {
    const { service } = build({ connection: undefined });
    const error = await service.getUserAccess('microsoft_365', 'user-1', 'ws-1').catch((e) => e);
    expect(error).toBeInstanceOf(IntegrationNeedsConnectionError);
    expect(error.details).toMatchObject({
      needsConnection: true,
      integrationId: 'int-1',
      integrationType: 'microsoft_365',
      integrationName: 'Microsoft 365',
    });
  });

  it('treats an invalidated row as needs-connection', async () => {
    const { service } = build({
      connection: { id: 'conn-1', kind: 'user', accessToken: 'enc', invalidatedAt: new Date() },
    });
    await expect(service.getUserAccess('microsoft_365', 'user-1', 'ws-1')).rejects.toBeInstanceOf(
      IntegrationNeedsConnectionError,
    );
  });

  it('retires the connection when the refresh is rejected', async () => {
    const { service, connectionRepo } = build({
      token: () => Promise.reject(new TokenInvalidError()),
    });
    await expect(service.getUserAccess('microsoft_365', 'user-1', 'ws-1')).rejects.toBeInstanceOf(
      IntegrationNeedsConnectionError,
    );
    expect(connectionRepo.invalidate).toHaveBeenCalledWith('conn-1', { accessToken: 'enc' });
  });

  it('keeps the connection when the refresh fails transiently', async () => {
    const { service, connectionRepo } = build({
      token: () => Promise.reject(new TokenExpiredError()),
    });
    await expect(service.getUserAccess('microsoft_365', 'user-1', 'ws-1')).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
    expect(connectionRepo.invalidate).not.toHaveBeenCalled();
  });

  it('never hands out a workspace bot row as a personal connection', async () => {
    const { service } = build({
      connection: { id: 'bot', kind: 'workspace', accessToken: 'enc', invalidatedAt: null },
    });
    await expect(service.getUserAccess('microsoft_365', 'user-1', 'ws-1')).rejects.toBeInstanceOf(
      IntegrationNeedsConnectionError,
    );
  });
});
