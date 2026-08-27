import { GoogleGroupsService } from './google-groups.service';

describe('GoogleGroupsService.safeListGroupsForUser', () => {
  const makeService = (opts: {
    configured: boolean;
    listImpl?: () => Promise<string[]>;
  }) => {
    const service = new GoogleGroupsService(
      {
        isGoogleGroupSyncConfigured: () => opts.configured,
      } as any,
      { get: jest.fn(), set: jest.fn() } as any,
    );

    if (opts.listImpl) {
      jest
        .spyOn(service, 'listGroupsForUser')
        .mockImplementation(opts.listImpl);
    }
    return service;
  };

  it('returns null when group sync is not configured', async () => {
    const service = makeService({ configured: false });
    await expect(service.safeListGroupsForUser('a@b.com')).resolves.toBeNull();
  });

  it('returns null instead of throwing when Cloud Identity fails', async () => {
    // A Google outage must degrade to "log in without sync", never block login.
    const service = makeService({
      configured: true,
      listImpl: () => Promise.reject(new Error('503 upstream unavailable')),
    });

    await expect(service.safeListGroupsForUser('a@b.com')).resolves.toBeNull();
  });

  it('passes through the group list on success', async () => {
    const service = makeService({
      configured: true,
      listImpl: () => Promise.resolve(['eng@acme.com']),
    });

    await expect(service.safeListGroupsForUser('a@b.com')).resolves.toEqual([
      'eng@acme.com',
    ]);
  });
});
