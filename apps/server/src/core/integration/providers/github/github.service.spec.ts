import { proxyFetch } from '../../../../common/proxy-fetch';
import { UnfurlForbiddenError } from '../../registry/integration-provider.interface';
import { GitHubProvider } from './github.provider';
import { GitHubService } from './github.service';

// Mock only proxyFetch so the real providerApiFetch handles statuses.
jest.mock('../../../../common/proxy-fetch', () => ({
  proxyFetch: jest.fn(),
}));

const fetchMock = proxyFetch as jest.Mock;

const API = 'https://api.github.com';
const ENTERPRISE_API = 'https://github.acme.com/api/v3';
const PAGE = 'https://github.com/o/r/pull/1';
const WHEN = '2026-10-01T10:00:00.000Z';

const BODY = {
  number: 1,
  title: 'Add dark mode',
  created_at: WHEN,
  updated_at: WHEN,
  full_name: 'o/r',
  sha: 'abc1234',
  commit: { message: 'Fix header', author: { date: WHEN } },
};

const service = new GitHubService();

const REQUESTS: [string, (api: string, owner: string, repo: string) => Promise<unknown>, string][] = [
  ['pull request', (api, owner, repo) => service.unfurlPullRequest('token', api, owner, repo, 1, PAGE), '/pulls/1'],
  ['issue', (api, owner, repo) => service.unfurlIssue('token', api, owner, repo, 2, PAGE), '/issues/2'],
  ['repo', (api, owner, repo) => service.unfurlRepo('token', api, owner, repo, PAGE), ''],
  ['commit', (api, owner, repo) => service.unfurlCommit('token', api, owner, repo, 'abc1234', PAGE), '/commits/abc1234'],
  ['collection page', (api, owner, repo) => service.unfurlCollectionPage('token', api, owner, repo, 'pulls-list', PAGE), ''],
];

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map(([url]) => url);
}

describe('GitHubService API paths', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify(BODY), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
  });

  it.each(REQUESTS)('requests a %s under the plain repo path', async (_, request, suffix) => {
    await request(API, 'o', 'r');

    expect(requestedUrls()).toEqual([`${API}/repos/o/r${suffix}`]);
  });

  it.each(REQUESTS)(
    'percent-encodes owner and repo for a %s, so neither can add a query or path',
    async (_, request, suffix) => {
      await request(API, 'a b', 'r?x=/#');

      const requested = new URL(requestedUrls()[0]);
      expect(requested.pathname).toBe(`/repos/a%20b/r%3Fx%3D%2F%23${suffix}`);
      expect(requested.search).toBe('');
    },
  );

  it.each(REQUESTS)(
    'keeps an encoded dot segment for a %s inside the Enterprise api root',
    async (_, request, suffix) => {
      await request(ENTERPRISE_API, '%2e%2e', '..x');

      expect(new URL(requestedUrls()[0]).pathname).toBe(
        `/api/v3/repos/%252e%252e/..x${suffix}`,
      );
    },
  );

  describe.each([
    ['.', 'r'],
    ['..', 'r'],
    ['o', '.'],
    ['o', '..'],
  ])('with owner %j and repo %j', (owner, repo) => {
    it.each(REQUESTS)('refuses a %s without calling GitHub', async (_, request) => {
      await expect(request(ENTERPRISE_API, owner, repo)).rejects.toBeInstanceOf(
        UnfurlForbiddenError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

describe('GitHub connected account', () => {
  const original = process.env.INTEGRATION_GITHUB_URL;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 583231,
          login: 'Philipinho',
          name: 'Philip Okugbe',
          email: 'philip@docmost.com',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_GITHUB_URL;
    else process.env.INTEGRATION_GITHUB_URL = original;
  });

  it('reads the account from api.github.com and keeps no email', async () => {
    delete process.env.INTEGRATION_GITHUB_URL;
    const provider = new GitHubProvider(new GitHubService());

    await expect(
      provider.resolveAccount({ accessToken: 'token', tokenResponse: {} }),
    ).resolves.toEqual({
      id: '583231',
      displayName: 'Philip Okugbe',
      username: 'Philipinho',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/user');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('reads the account from the GitHub Enterprise API', async () => {
    process.env.INTEGRATION_GITHUB_URL = 'https://github.acme.com';
    const provider = new GitHubProvider(new GitHubService());

    await provider.resolveAccount({ accessToken: 'token', tokenResponse: {} });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://github.acme.com/api/v3/user',
    );
  });
});
