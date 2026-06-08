import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationManifest } from './manifest.types';

function manifest(id: string): IntegrationManifest {
  return {
    id,
    name: id,
    baseUrl: () => 'https://provider.example.com',
    authorizePath: '/oauth/authorize',
    tokenPath: '/oauth/token',
    scopes: ['read'],
    clientIdEnv: 'TEST_CLIENT_ID',
    clientSecretEnv: 'TEST_CLIENT_SECRET',
  } as IntegrationManifest;
}

describe('IntegrationOAuthRegistry', () => {
  let registry: IntegrationOAuthRegistry;

  beforeEach(() => {
    registry = new IntegrationOAuthRegistry();
  });

  it('registers and lists manifests', () => {
    registry.register(manifest('alpha'));
    registry.register(manifest('beta'));
    expect(registry.list().map((m) => m.id)).toEqual(['alpha', 'beta']);
  });

  it('rejects duplicate ids', () => {
    registry.register(manifest('alpha'));
    expect(() => registry.register(manifest('alpha'))).toThrow(
      /already registered/,
    );
  });

  it('returns undefined for unknown ids', () => {
    expect(registry.get('nope')).toBeUndefined();
    expect(registry.getForIntegrationId('nope:0000')).toBeUndefined();
  });

  it('require throws for unknown ids', () => {
    expect(() => registry.require('nope')).toThrow(/Unknown integration/);
    expect(() => registry.requireForIntegrationId('nope:0000')).toThrow(
      /Unknown integration/,
    );
  });

  it('resolves provider manifests from providerId:uuid integration ids', () => {
    registry.register(manifest('alpha'));
    const id = 'alpha:7c5e6cb2-0000-4000-8000-000000000000';
    expect(registry.providerIdFor(id)).toBe('alpha');
    expect(registry.getForIntegrationId(id)?.id).toBe('alpha');
    expect(registry.requireForIntegrationId(id).id).toBe('alpha');
  });

  it('treats a bare provider id as its own integration id', () => {
    registry.register(manifest('alpha'));
    expect(registry.getForIntegrationId('alpha')?.id).toBe('alpha');
  });
});
