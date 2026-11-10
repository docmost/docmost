import { WsService } from './ws.service';

function makeService(accessBySpace: Record<string, string[]>) {
  const spaceMemberRepo = {
    getUserIdsWithSpaceAccess: jest.fn(
      async (_userIds: string[], spaceId: string) =>
        new Set(accessBySpace[spaceId] ?? []),
    ),
  };
  const baseRealtime = {
    removeUsersFromSpaceBases: jest.fn(async () => undefined),
  };
  const socketsLeave = jest.fn();
  const server = { in: jest.fn(() => ({ socketsLeave })) };

  const service = new WsService(
    {} as any,
    {} as any,
    spaceMemberRepo as any,
    baseRealtime as any,
    {} as any,
    {} as any,
  );
  service.setServer(server as any);

  return { service, server, socketsLeave, baseRealtime };
}

describe('WsService.removeUsersWithoutSpaceAccess', () => {
  it('removes users who lost access from the space room and its bases', async () => {
    const { service, server, socketsLeave, baseRealtime } = makeService({
      space_1: ['user_2'],
    });

    await service.removeUsersWithoutSpaceAccess(
      ['user_1', 'user_2'],
      ['space_1'],
    );

    expect(server.in).toHaveBeenCalledTimes(1);
    expect(server.in).toHaveBeenCalledWith(['user-user_1']);
    expect(socketsLeave).toHaveBeenCalledWith('space-space_1');
    expect(baseRealtime.removeUsersFromSpaceBases).toHaveBeenCalledWith(
      ['user_1'],
      'space_1',
    );
  });

  it('keeps users in spaces they can still access', async () => {
    const { service, server, socketsLeave, baseRealtime } = makeService({
      space_1: ['user_1'],
    });

    await service.removeUsersWithoutSpaceAccess(
      ['user_1'],
      ['space_1', 'space_2'],
    );

    expect(server.in).toHaveBeenCalledTimes(1);
    expect(socketsLeave).toHaveBeenCalledWith('space-space_2');
    expect(baseRealtime.removeUsersFromSpaceBases).toHaveBeenCalledTimes(1);
    expect(baseRealtime.removeUsersFromSpaceBases).toHaveBeenCalledWith(
      ['user_1'],
      'space_2',
    );
  });
});
