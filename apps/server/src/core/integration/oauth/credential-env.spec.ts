import { credentialEnvKey } from './credential-env';

describe('credentialEnvKey', () => {
  it('names credentials after the provider type by default', () => {
    expect(credentialEnvKey('CLIENT_ID', 'github')).toBe(
      'INTEGRATION_GITHUB_CLIENT_ID',
    );
    expect(credentialEnvKey('CLIENT_SECRET', 'gitlab', {})).toBe(
      'INTEGRATION_GITLAB_CLIENT_SECRET',
    );
  });

  it('names credentials after the shared authorization server when declared', () => {
    expect(
      credentialEnvKey('CLIENT_ID', 'jira', { credentialsKey: 'atlassian' }),
    ).toBe('INTEGRATION_ATLASSIAN_CLIENT_ID');
    expect(
      credentialEnvKey('CLIENT_SECRET', 'google_docs', {
        credentialsKey: 'google',
      }),
    ).toBe('INTEGRATION_GOOGLE_CLIENT_SECRET');
  });
});
