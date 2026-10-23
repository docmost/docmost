import { IntegrationRegistry } from './integration-registry';
import { IntegrationProvider } from './integration-provider.interface';

const provider = (type: string) =>
  ({ definition: { type, name: type } }) as unknown as IntegrationProvider;

describe('IntegrationRegistry', () => {
  it('registers providers by type', () => {
    const registry = new IntegrationRegistry();
    const github = provider('github');

    registry.register(github);

    expect(registry.getProvider('github')).toBe(github);
  });

  it('refuses a second provider with the same type', () => {
    const registry = new IntegrationRegistry();
    registry.register(provider('linear'));

    expect(() => registry.register(provider('linear'))).toThrow(
      'Integration provider "linear" is already registered',
    );
  });

  describe('available integrations', () => {
    const types = ['github', 'figma', 'linear', 'jira', 'gitlab'];

    it('offers only GitHub, GitLab and Linear on Cloud', () => {
      const registry = new IntegrationRegistry(true);
      types.forEach((type) => registry.register(provider(type)));

      expect(registry.getAvailableIntegrations().map((d) => d.type)).toEqual([
        'github',
        'linear',
        'gitlab',
      ]);
      // Existing installs of the others keep unfurling.
      expect(registry.getProvider('figma')).toBeDefined();
    });

    it('offers every provider on self-hosted', () => {
      const registry = new IntegrationRegistry();
      types.forEach((type) => registry.register(provider(type)));

      expect(registry.getAvailableIntegrations().map((d) => d.type)).toEqual(
        types,
      );
    });
  });
});
