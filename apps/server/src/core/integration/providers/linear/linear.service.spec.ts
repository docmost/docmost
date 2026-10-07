import { proxyFetch } from '../../../../common/proxy-fetch';
import { LinearProvider } from './linear.provider';
import { LinearService } from './linear.service';

// Mock only proxyFetch so the real providerApiFetch handles statuses.
jest.mock('../../../../common/proxy-fetch', () => ({
  proxyFetch: jest.fn(),
}));

const fetchMock = proxyFetch as jest.Mock;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Linear connected account', () => {
  const provider = new LinearProvider(new LinearService());

  beforeEach(() => fetchMock.mockReset());

  it('reads the viewer as the connected account', async () => {
    fetchMock.mockResolvedValue(
      json({
        data: {
          viewer: {
            id: '8f3e1b2a-4c5d-4e6f-9a0b-1c2d3e4f5a6b',
            name: 'Philip Okugbe',
            displayName: 'philip',
          },
        },
      }),
    );

    await expect(
      provider.resolveAccount({ accessToken: 'token', tokenResponse: {} }),
    ).resolves.toEqual({
      id: '8f3e1b2a-4c5d-4e6f-9a0b-1c2d3e4f5a6b',
      displayName: 'Philip Okugbe',
      username: 'philip',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.linear.app/graphql');
    expect(JSON.parse(init.body).query).toContain(
      'viewer { id name displayName }',
    );
  });

  it('fails when Linear returns no viewer', async () => {
    fetchMock.mockResolvedValue(json({ errors: [{ message: 'not authorized' }] }));

    await expect(
      provider.resolveAccount({ accessToken: 'token', tokenResponse: {} }),
    ).rejects.toThrow('Provider profile has no account id');
  });
});
