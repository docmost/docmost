import { Logger } from '@nestjs/common';
import { GitHubProvider } from './github.provider';
import { IntegrationRegistry } from '../../registry/integration-registry';
import { UnfurlPattern } from '../../registry/integration-provider.interface';

const GHE_BASE = 'https://github.acme.com';
const PUBLIC_PR = 'https://github.com/o/r/pull/1';
const GHE_PR = `${GHE_BASE}/o/r/pull/1`;

function buildProvider() {
  const unfurlPullRequest = jest.fn().mockResolvedValue({});
  const provider = new GitHubProvider({ unfurlPullRequest } as any);
  return { provider, unfurlPullRequest };
}

function firstMatch(patterns: UnfurlPattern[], url: string) {
  for (const pattern of patterns) {
    const match = url.match(pattern.regex);
    if (match) return { match, patternType: pattern.type };
  }
  return null;
}

function matches(provider: GitHubProvider, url: string): boolean {
  return firstMatch(provider.getUnfurlPatterns({}), url) !== null;
}

async function unfurlWith(provider: GitHubProvider, url: string) {
  const found = firstMatch(provider.getUnfurlPatterns({}), url)!;
  await provider.unfurl({ ...found, url, accessToken: 'token' } as any);
}

describe('GitHubProvider host matching', () => {
  const original = process.env.INTEGRATION_GITHUB_URL;

  beforeEach(() => delete process.env.INTEGRATION_GITHUB_URL);

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_GITHUB_URL;
    else process.env.INTEGRATION_GITHUB_URL = original;
  });

  it('declares no static unfurl patterns', () => {
    const { provider } = buildProvider();
    expect(provider.definition.unfurlPatterns).toBeUndefined();

    const registry = new IntegrationRegistry();
    registry.register(provider);
    expect(registry.findUnfurlProvider(PUBLIC_PR)).toBeNull();
  });

  describe('github.com (no INTEGRATION_GITHUB_URL)', () => {
    it('matches github.com links', () => {
      const { provider } = buildProvider();
      expect(matches(provider, PUBLIC_PR)).toBe(true);
      expect(matches(provider, 'https://github.com/o/r')).toBe(true);
      expect(matches(provider, GHE_PR)).toBe(false);
    });

    it('calls api.github.com', async () => {
      const { provider, unfurlPullRequest } = buildProvider();
      await unfurlWith(provider, PUBLIC_PR);
      expect(unfurlPullRequest).toHaveBeenCalledWith(
        'token', 'https://api.github.com', 'o', 'r', 1, PUBLIC_PR,
      );
    });
  });

  describe('GitHub Enterprise (INTEGRATION_GITHUB_URL set)', () => {
    beforeEach(() => {
      process.env.INTEGRATION_GITHUB_URL = GHE_BASE;
    });

    it('does not match github.com links', () => {
      const { provider } = buildProvider();
      expect(matches(provider, PUBLIC_PR)).toBe(false);
      expect(matches(provider, 'https://github.com/o/r')).toBe(false);
    });

    it('matches links on the configured host', () => {
      const { provider } = buildProvider();
      expect(matches(provider, GHE_PR)).toBe(true);
      expect(matches(provider, `${GHE_BASE}/o/r`)).toBe(true);
    });

    it('sends the token to the configured instance api', async () => {
      const { provider, unfurlPullRequest } = buildProvider();
      await unfurlWith(provider, GHE_PR);
      expect(unfurlPullRequest).toHaveBeenCalledWith(
        'token', `${GHE_BASE}/api/v3`, 'o', 'r', 1, GHE_PR,
      );
    });

    it.each(['https://GitHub.Acme.com', 'https://github.acme.com/', 'HTTPS://GITHUB.ACME.COM//'])(
      'normalizes %s to match lowercase pasted links',
      async (configured) => {
        process.env.INTEGRATION_GITHUB_URL = configured;
        const { provider, unfurlPullRequest } = buildProvider();
        expect(matches(provider, GHE_PR)).toBe(true);
        await unfurlWith(provider, GHE_PR);
        expect(unfurlPullRequest.mock.calls[0][1]).toBe(`${GHE_BASE}/api/v3`);
      },
    );
  });

  describe('INTEGRATION_GITHUB_URL validation', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => warn.mockRestore());

    it.each(['github.acme.com', 'github.acme.com:8443', 'ftp://github.acme.com'])(
      'warns once and falls back to github.com for %s',
      async (configured) => {
        process.env.INTEGRATION_GITHUB_URL = configured;
        const { provider, unfurlPullRequest } = buildProvider();

        expect(matches(provider, PUBLIC_PR)).toBe(true);
        expect(matches(provider, GHE_PR)).toBe(false);
        expect(provider.getOAuthConfig({})).toMatchObject({
          authUrl: 'https://github.com/login/oauth/authorize',
          tokenUrl: 'https://github.com/login/oauth/access_token',
        });
        await unfurlWith(provider, PUBLIC_PR);
        expect(unfurlPullRequest.mock.calls[0][1]).toBe('https://api.github.com');

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          'INTEGRATION_GITHUB_URL is not a valid http(s) URL; falling back to https://github.com',
        );
      },
    );

    it('does not warn for a valid url', async () => {
      process.env.INTEGRATION_GITHUB_URL = GHE_BASE;
      const { provider } = buildProvider();
      provider.getOAuthConfig({});
      await unfurlWith(provider, GHE_PR);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('getUnfurlHosts', () => {
    it('reports github.com when INTEGRATION_GITHUB_URL is unset', () => {
      const { provider } = buildProvider();
      expect(provider.getUnfurlHosts({})).toEqual(['github.com']);
    });

    it('reports the configured host', () => {
      process.env.INTEGRATION_GITHUB_URL = GHE_BASE;
      const { provider } = buildProvider();
      expect(provider.getUnfurlHosts({})).toEqual(['github.acme.com']);
    });

    it.each(['https://GitHub.Acme.com', 'https://github.acme.com/'])(
      'reports %s as a lowercase hostname',
      (configured) => {
        process.env.INTEGRATION_GITHUB_URL = configured;
        const { provider } = buildProvider();
        expect(provider.getUnfurlHosts({})).toEqual(['github.acme.com']);
      },
    );
  });
});
