import { CollabAccessService } from './collab-access.service';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

function makeService(publish: (...args: any[]) => Promise<number>) {
  return new CollabAccessService({ getOrThrow: () => ({ publish }) } as any);
}

describe('CollabAccessService', () => {
  it('publishes the users or pages to recheck', async () => {
    const publish = jest.fn(async () => 1);

    await makeService(publish).recheckAccess({ userIds: ['user_1'] });
    await makeService(publish).recheckAccess({ userIds: [], pageIds: [] });

    expect(publish.mock.calls).toEqual([
      [COLLAB_ACCESS_RECHECK_CHANNEL, JSON.stringify({ userIds: ['user_1'] })],
    ]);
  });

  it('does not throw when publishing fails', async () => {
    const service = makeService(async () => {
      throw new Error('redis down');
    });

    await expect(
      service.recheckAccess({ userIds: ['user_1'] }),
    ).resolves.toBeUndefined();
  });
});
