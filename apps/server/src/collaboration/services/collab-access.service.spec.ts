import { CollabAccessService } from './collab-access.service';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

function makeService(
  publish: (...args: any[]) => Promise<number>,
  add = jest.fn().mockResolvedValue(undefined),
) {
  return new CollabAccessService(
    { getOrThrow: () => ({ publish }) } as any,
    { add } as any,
  );
}

describe('CollabAccessService', () => {
  it('publishes the users or pages to recheck', async () => {
    const publish = jest.fn(async () => 1);

    const add = jest.fn().mockResolvedValue(undefined);
    await makeService(publish, add).recheckAccess({ userIds: ['user_1'] });
    expect(add).toHaveBeenCalledWith('page-tasks-updated', {
      userIds: ['user_1'],
    });
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
