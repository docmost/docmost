import { proxyFetch } from '../../../../common/proxy-fetch';
import { FigmaProvider } from './figma.provider';
import { FigmaService } from './figma.service';

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

describe('Figma connected account', () => {
  const provider = new FigmaProvider(new FigmaService());

  beforeEach(() => fetchMock.mockReset());

  it('asks for the profile scope beside file metadata', () => {
    expect(provider.definition.oauth?.scopes).toEqual([
      'file_metadata:read',
      'current_user:read',
    ]);
  });

  it('reads the connected account from /v1/me and keeps no email', async () => {
    fetchMock.mockResolvedValue(
      json({
        id: '1234567890',
        handle: 'Philip Okugbe',
        email: 'philip@docmost.com',
        img_url: 'https://s3-alpha.figma.com/profile/1234567890',
      }),
    );

    await expect(
      provider.resolveAccount({ accessToken: 'token', tokenResponse: {} }),
    ).resolves.toEqual({ id: '1234567890', displayName: 'Philip Okugbe' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.figma.com/v1/me');
  });
});
