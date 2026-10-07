import { supportsOAuthConnect } from './oauth-connect';

const base = { authUrl: 'https://p.example/authorize', tokenUrl: 'https://p.example/token', scopes: [] };

describe('supportsOAuthConnect', () => {
  it('is false for providers without OAuth', () => {
    expect(supportsOAuthConnect(undefined)).toBe(false);
  });

  it('is true for per-user providers', () => {
    expect(supportsOAuthConnect(base)).toBe(true);
    expect(supportsOAuthConnect({ ...base, connectionScope: 'user' })).toBe(true);
  });

  it('is false for workspace-scoped providers without an identity flow', () => {
    expect(supportsOAuthConnect({ ...base, connectionScope: 'workspace' })).toBe(false);
  });

  it('is true for workspace-scoped providers with an identity flow', () => {
    expect(
      supportsOAuthConnect({
        ...base,
        connectionScope: 'workspace',
        identity: { authUrl: 'https://p.example/oidc', tokenUrl: 'https://p.example/oidc/token', scopes: ['openid'] },
      }),
    ).toBe(true);
  });
});
