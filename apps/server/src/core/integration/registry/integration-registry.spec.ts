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
});
