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

describe('WsService.handleTreeEvent', () => {
  const ROOM = 'space-space_1';
  const UPDATE = {
    operation: 'updateOne',
    spaceId: 'space_1',
    entity: ['pages'],
    id: 'page_1',
    payload: { title: 'Draft title' },
  };

  function makeRelay(opts: {
    controlledSpace?: boolean;
    controlledPage?: boolean;
    restrictedSpaceCached?: boolean;
    pageAccess?: string[];
    draftAccess?: string[];
  }) {
    const sockets = ['sender', 'writer', 'reader', 'approver'].map(
      (userId) => ({
        id: `socket-${userId}`,
        data: { userId },
        emit: jest.fn(),
      }),
    );
    const roomBroadcast = jest.fn();
    const client = {
      id: 'socket-sender',
      data: { userId: 'sender' },
      rooms: new Set([ROOM]),
      broadcast: { to: jest.fn(() => ({ emit: roomBroadcast })) },
    };
    const server = {
      in: jest.fn(() => ({ fetchSockets: async () => sockets })),
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
      get: jest.fn(async () => opts.restrictedSpaceCached ?? undefined),
      set: jest.fn(async () => undefined),
    };
    const spaceMemberRepo = {
      getUserSpaceRoles: jest.fn(async () => [{ role: 'writer' }]),
    };
    const state = { controlled: !!opts.controlledPage };
    const pageApprovalService = {
      getState: jest.fn(async () => state),
      getUserIdsWithDraftAccess: jest.fn(async () => opts.draftAccess ?? []),
    };

    const service = new WsService(
      pagePermissionRepo as any,
      cacheManager as any,
      spaceMemberRepo as any,
      {} as any,
      {} as any,
      {} as any,
      pageApprovalService as any,
    );
    service.setServer(server as any);

    const received = () =>
      sockets
        .filter((s) => s.emit.mock.calls.length > 0)
        .map((s) => [s.data.userId, s.emit.mock.calls[0][1]]);

    return {
      service,
      client,
      state,
      roomBroadcast,
      pagePermissionRepo,
      pageApprovalService,
      received,
    };
  }

  it('relays a tree event for a controlled page only to draft users, never to the sender socket', async () => {
    const relay = makeRelay({
      controlledSpace: true,
      controlledPage: true,
      draftAccess: ['writer', 'approver'],
    });

    await relay.service.handleTreeEvent(relay.client as any, UPDATE);

    expect(relay.roomBroadcast).not.toHaveBeenCalled();
    expect(relay.received()).toEqual([
      ['writer', UPDATE],
      ['approver', UPDATE],
    ]);
    expect(relay.pageApprovalService.getUserIdsWithDraftAccess).toHaveBeenCalledWith(
      { id: 'page_1', spaceId: 'space_1', isBase: false },
      ['writer', 'reader', 'approver'],
      relay.state,
    );
    expect(relay.pagePermissionRepo.getUserIdsWithPageAccess).not.toHaveBeenCalled();
  });

  it('relays an uncontrolled page in a space with controlled pages to users who can see it', async () => {
    const relay = makeRelay({
      controlledSpace: true,
      controlledPage: false,
      pageAccess: ['writer', 'reader'],
    });

    await relay.service.handleTreeEvent(relay.client as any, UPDATE);

    expect(relay.roomBroadcast).not.toHaveBeenCalled();
    expect(relay.pagePermissionRepo.getUserIdsWithPageAccess).toHaveBeenCalledWith(
      'page_1',
      ['writer', 'reader', 'approver'],
    );
    expect(relay.received().map(([userId]) => userId)).toEqual([
      'writer',
      'reader',
    ]);
  });

  it('ignores a cached no-restrictions answer when the space has controlled pages', async () => {
    const relay = makeRelay({
      controlledSpace: true,
      controlledPage: true,
      restrictedSpaceCached: false,
      draftAccess: ['writer'],
    });

    await relay.service.handleTreeEvent(relay.client as any, UPDATE);

    expect(relay.roomBroadcast).not.toHaveBeenCalled();
    expect(relay.received().map(([userId]) => userId)).toEqual(['writer']);
  });

  it('drops the subtree of a deleted node before relaying it in a space with controlled pages', async () => {
    const relay = makeRelay({ controlledSpace: true, controlledPage: false });
    const deleted = {
      operation: 'deleteTreeNode',
      spaceId: 'space_1',
      payload: {
        node: {
          id: 'page_1',
          slugId: 'slug1',
          parentPageId: null,
          name: 'Visible',
          children: [{ id: 'hidden_child', name: 'Unpublished title' }],
        },
      },
    };

    await relay.service.handleTreeEvent(relay.client as any, deleted);

    const [, event] = relay.received()[0];
    expect(JSON.stringify(event)).not.toContain('Unpublished title');
    expect(event.payload.node).toMatchObject({
      id: 'page_1',
      slugId: 'slug1',
      parentPageId: null,
    });
    expect(deleted.payload.node.children).toHaveLength(1);
  });

  it('keeps the room broadcast in a space without restrictions or controlled pages', async () => {
    const relay = makeRelay({});

    await relay.service.handleTreeEvent(relay.client as any, UPDATE);

    expect(relay.roomBroadcast).toHaveBeenCalledWith('message', UPDATE);
    expect(relay.received()).toEqual([]);
    expect(relay.pageApprovalService.getState).not.toHaveBeenCalled();
  });
});
