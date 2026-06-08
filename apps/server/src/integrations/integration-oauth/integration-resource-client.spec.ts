import { createScopedResourceClient } from './integration-resource-client';
import { IntegrationOAuthClientService } from './integration-oauth-client.service';
import { IntegrationResourceManifest } from './resource.types';

const SCOPE = {
  integrationId: 'alpha:1111',
  workspaceId: 'ws-1',
  userId: 'user-1',
};

function resource(outboundPaths?: string[]): IntegrationResourceManifest {
  return {
    id: 'thing',
    title: 'Thing',
    renderKind: 'item-card',
    security: outboundPaths ? { outboundPaths } : undefined,
    resolve: async () => ({ kind: 'item-card', key: 'k', title: 't' }),
  };
}

describe('createScopedResourceClient', () => {
  let clientService: jest.Mocked<
    Pick<IntegrationOAuthClientService, 'get' | 'baseUrl' | 'settings'>
  >;

  beforeEach(() => {
    clientService = {
      get: jest.fn().mockResolvedValue({ ok: true }),
      baseUrl: jest.fn().mockResolvedValue('https://provider.example.com'),
      settings: jest.fn().mockResolvedValue({ defaultWorkspaceKey: 'WI' }),
    };
  });

  function client(outboundPaths?: string[]) {
    return createScopedResourceClient(
      clientService as unknown as IntegrationOAuthClientService,
      resource(outboundPaths),
      SCOPE,
    );
  }

  it('allows declared literal paths and binds the scope', async () => {
    const c = client(['/api/items']);
    await c.get('/api/items', { q: 'x' });
    expect(clientService.get).toHaveBeenCalledWith(
      SCOPE.integrationId,
      SCOPE.workspaceId,
      SCOPE.userId,
      '/api/items',
      { q: 'x' },
    );
  });

  it('matches :param segments against exactly one segment', async () => {
    const c = client(['/api/items/:id']);
    await expect(c.get('/api/items/42')).resolves.toEqual({ ok: true });
    await expect(c.get('/api/items')).rejects.toThrow(/not declared/);
    await expect(c.get('/api/items/42/comments')).rejects.toThrow(
      /not declared/,
    );
  });

  it('rejects undeclared paths', async () => {
    const c = client(['/api/items']);
    await expect(c.get('/api/admin/users')).rejects.toThrow(/not declared/);
    expect(clientService.get).not.toHaveBeenCalled();
  });

  it('rejects path traversal away from declared prefixes', async () => {
    const c = client(['/api/items/:id']);
    await expect(c.get('/api/items/../admin')).rejects.toThrow(/not declared/);
  });

  it('blocks every path when the resource declares none', async () => {
    const c = client(undefined);
    await expect(c.get('/api/items')).rejects.toThrow(/not declared/);
  });

  it('does not treat regex metacharacters in declarations as patterns', async () => {
    const c = client(['/api/items.json']);
    await expect(c.get('/api/itemsXjson')).rejects.toThrow(/not declared/);
    await expect(c.get('/api/items.json')).resolves.toEqual({ ok: true });
  });

  it('passes baseUrl and settings through with the bound scope', async () => {
    const c = client(['/api/items']);
    await expect(c.baseUrl()).resolves.toBe('https://provider.example.com');
    await expect(c.settings()).resolves.toEqual({ defaultWorkspaceKey: 'WI' });
    expect(clientService.baseUrl).toHaveBeenCalledWith(
      SCOPE.integrationId,
      SCOPE.workspaceId,
    );
    expect(clientService.settings).toHaveBeenCalledWith(
      SCOPE.integrationId,
      SCOPE.workspaceId,
    );
  });
});
