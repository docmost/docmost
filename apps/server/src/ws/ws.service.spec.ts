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

describe('WsService.emitCommentEvent', () => {
  const DATA = { operation: 'commentCreated', pageId: 'page_1' };

  function makeEmitter(opts: {
    controlledSpace?: boolean;
    pageAccess?: string[];
    draftAccess?: string[];
  }) {
    const sockets = ['writer', 'reader', 'approver'].map((userId) => ({
      data: { userId },
      emit: jest.fn(),
    }));
    const roomEmit = jest.fn();
    const server = {
      in: jest.fn(() => ({ fetchSockets: async () => sockets })),
      to: jest.fn(() => ({ emit: roomEmit })),
    };
    const pagePermissionRepo = {
      hasControlledPagesInSpace: jest.fn(async () => !!opts.controlledSpace),
      hasRestrictedPagesInSpace: jest.fn(async () => false),
      hasRestrictedAncestor: jest.fn(async () => false),
      getUserIdsWithPageAccess: jest.fn(
        async () => opts.pageAccess ?? ['writer', 'reader', 'approver'],
      ),
    };
    const cacheManager = {
      get: jest.fn(async () => undefined),
      set: jest.fn(async () => undefined),
    };
    const pageApprovalService = {
      getUserIdsWithDraftAccess: jest.fn(async () => opts.draftAccess ?? []),
    };

    const service = new WsService(
      pagePermissionRepo as any,
      cacheManager as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      pageApprovalService as any,
    );
    service.setServer(server as any);

    const receivers = () =>
      sockets
        .filter((s) => s.emit.mock.calls.length > 0)
        .map((s) => s.data.userId);

    return {
      service,
      roomEmit,
      pagePermissionRepo,
      pageApprovalService,
      receivers,
    };
  }

  it('sends draft-only events to draft users alone', async () => {
    const { service, roomEmit, pageApprovalService, receivers } = makeEmitter({
      draftAccess: ['writer', 'approver'],
    });

    await service.emitCommentEvent('space_1', 'page_1', DATA, {
      draftOnly: true,
    });

    expect(receivers()).toEqual(['writer', 'approver']);
    expect(roomEmit).not.toHaveBeenCalled();
    expect(pageApprovalService.getUserIdsWithDraftAccess).toHaveBeenCalledWith(
      { id: 'page_1', spaceId: 'space_1', isBase: false },
      ['writer', 'reader', 'approver'],
    );
  });

  it('fans out per user in a space with controlled pages, even without restrictions', async () => {
    const { service, roomEmit, pagePermissionRepo, receivers } = makeEmitter({
      controlledSpace: true,
      pageAccess: ['writer'],
    });

    await service.emitCommentEvent('space_1', 'page_1', DATA);

    expect(roomEmit).not.toHaveBeenCalled();
    expect(pagePermissionRepo.getUserIdsWithPageAccess).toHaveBeenCalledWith(
      'page_1',
      ['writer', 'reader', 'approver'],
    );
    expect(receivers()).toEqual(['writer']);
  });

  it('still broadcasts to the room in a space without restrictions or controlled pages', async () => {
    const { service, roomEmit, receivers } = makeEmitter({});

    await service.emitCommentEvent('space_1', 'page_1', DATA);

    expect(roomEmit).toHaveBeenCalledWith('message', DATA);
    expect(receivers()).toEqual([]);
  });
});
