import { BadRequestException } from '@nestjs/common';
import { OAuthService } from './oauth.service';

const integrationId = 'integration-1';
const workspaceId = 'workspace-1';
const providerUserId = 'U-slack-1';

function buildService(existingLinkUserId?: string) {
  const provider = {
    definition: {
      oauth: {
        connectionScope: 'workspace',
        identity: { tokenUrl: 'https://slack.example/token' },
      },
    },
    resolveIdentity: jest.fn().mockResolvedValue({ account: { id: providerUserId } }),
  };

  const findUserLink = jest
    .fn()
    .mockResolvedValue(
      existingLinkUserId ? { userId: existingLinkUserId } : undefined,
    );
  const upsertUserLink = jest.fn().mockResolvedValue({ id: 'connection-1' });

  const service = new OAuthService(
    {} as any,
    {} as any,
    {} as any,
    { getProvider: jest.fn().mockReturnValue(provider) } as any,
    {
      findById: jest.fn().mockResolvedValue({ id: integrationId, workspaceId, settings: {} }),
    } as any,
    { findUserLink, upsertUserLink } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { log: jest.fn() } as any,
    { getOrThrow: () => ({}) } as any,
  );

  // Stub the live token exchange with the provider
  (service as any).requestTokens = jest
    .fn()
    .mockResolvedValue({ access_token: 'token' });

  return { service, findUserLink, upsertUserLink };
}

function connectState(userId: string) {
  return {
    flow: 'connect' as const,
    integrationId,
    type: 'slack',
    userId,
    workspaceId,
  };
}

describe('OAuthService identity link rebinding', () => {
  it('refuses a provider account already linked to another Docmost user', async () => {
    const { service, upsertUserLink } = buildService('user-a');

    await expect(
      service.exchangeCodeForTokens('slack', 'code', connectState('user-b')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(upsertUserLink).not.toHaveBeenCalled();
  });

  it('allows the same user to relink their own provider account', async () => {
    const { service, upsertUserLink } = buildService('user-a');

    await expect(
      service.exchangeCodeForTokens('slack', 'code', connectState('user-a')),
    ).resolves.toEqual({ id: 'connection-1' });

    expect(upsertUserLink).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', providerUserId }),
    );
  });

  it('allows a first-time link', async () => {
    const { service, upsertUserLink } = buildService();

    await expect(
      service.exchangeCodeForTokens('slack', 'code', connectState('user-b')),
    ).resolves.toEqual({ id: 'connection-1' });

    expect(upsertUserLink).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-b', providerUserId }),
    );
  });
});
