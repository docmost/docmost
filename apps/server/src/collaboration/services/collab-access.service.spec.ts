import { CollabAccessService } from './collab-access.service';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

function makeService(
  publish: (...args: any[]) => Promise<number>,
  notifyAccessChanged = jest.fn(),
) {
  return new CollabAccessService(
    { getOrThrow: () => ({ publish }) } as any,
    { notifyAccessChanged } as any,
  );
}

describe('CollabAccessService', () => {
  it('publishes the users or pages to recheck', async () => {
    const publish = jest.fn(async () => 1);
    const notify = jest.fn();
    const service = makeService(publish, notify);
    await service.recheckAccess({ userIds: ['user_1'] });
    await service.recheckAccess({
      pageIds: ['page_1'],
      spaceIds: ['old_space', 'new_space'],
    });
    await service.recheckAccess({ userIds: [], pageIds: [] });

    expect(publish.mock.calls).toEqual([
      [COLLAB_ACCESS_RECHECK_CHANNEL, JSON.stringify({ userIds: ['user_1'] })],
      [COLLAB_ACCESS_RECHECK_CHANNEL, JSON.stringify({ pageIds: ['page_1'] })],
    ]);
    expect(notify.mock.calls).toEqual([
      [['user_1'], []],
      [[], ['old_space', 'new_space']],
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
