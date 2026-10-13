import { Forbidden } from '@hocuspocus/common';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthenticationExtension } from './authentication.extension';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

const WRITER = [{ userId: 'any', role: 'writer' }];
const READER = [{ userId: 'any', role: 'reader' }];
const NO_ACCESS = JSON.stringify({ type: 'page.permissions', access: 'none' });
const READ_ACCESS = JSON.stringify({ type: 'page.permissions', access: 'read' });

function makeConnection(userId: string) {
  return {
    context: { user: { id: userId, workspaceId: 'ws_1' } },
    readOnly: false,
    close: jest.fn(),
    sendStateless: jest.fn(),
  };
}

async function makeExtension(
  spaceRoles: Record<string, unknown[] | undefined>,
  documents: Record<string, ReturnType<typeof makeConnection>[]> = {},
) {
  const subscriber = {
    on: jest.fn(),
    subscribe: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  };
  const spaceMemberRepo = {
    getUserSpaceRoles: jest.fn(async (userId: string) => spaceRoles[userId]),
  };
  const pagePermissionRepo = {
    canUserEditPage: jest.fn(async () => ({
      hasAnyRestriction: false,
      canAccess: true,
      canEdit: true,
    })),
  };
  const extension = new AuthenticationExtension(
    { verifyJwt: jest.fn(async (token: string) => ({ sub: token, workspaceId: 'ws_1' })) } as any,
    {
      findById: jest.fn(async (id: string) => {
        if (id === 'user_broken') throw new Error('db down');
        return { id, workspaceId: 'ws_1' };
      }),
    } as any,
    {
      findById: jest.fn(async (id: string) => ({
        id,
        spaceId: 'space_1',
        workspaceId: id === 'page_other_ws' ? 'ws_2' : 'ws_1',
        deletedAt: null,
      })),
      getPageAndDescendants: jest.fn(async (id: string) => [{ id }, { id: 'child_page' }]),
    } as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    { getOrThrow: () => ({ duplicate: () => subscriber }) } as any,
  );
  const instance = {
    documents: new Map(
      Object.entries(documents).map(([name, connections]) => [
        name,
        { name, getConnections: () => connections },
      ]),
    ),
  };
  await extension.onConfigure({ instance } as any);
  return { extension, subscriber, spaceMemberRepo, pagePermissionRepo };
}

describe('AuthenticationExtension access recheck', () => {
  it('closes connections of users who lost access and leaves others alone', async () => {
    const removed = makeConnection('user_removed');
    const other = makeConnection('user_other');
    const { extension } = await makeExtension(
      { user_removed: undefined, user_other: WRITER },
      { 'page.page_1': [removed, other] },
    );

    await extension.recheckAccess({ userIds: ['user_removed'] });

    expect(removed.sendStateless).toHaveBeenCalledWith(NO_ACCESS);
    expect(removed.readOnly).toBe(true);
    expect(removed.close).toHaveBeenCalledWith(Forbidden);
    expect(other.sendStateless).not.toHaveBeenCalled();
    expect(other.close).not.toHaveBeenCalled();
  });

  it('makes downgraded editors read-only without closing them', async () => {
    const downgraded = makeConnection('user_reader');
    const { extension } = await makeExtension(
      { user_reader: READER },
      { 'page.page_1': [downgraded] },
    );

    await extension.recheckAccess({ userIds: ['user_reader'] });

    expect(downgraded.readOnly).toBe(true);
    expect(downgraded.sendStateless).toHaveBeenCalledWith(READ_ACCESS);
    expect(downgraded.close).not.toHaveBeenCalled();
  });

  it('rechecks connections on pages under a changed page only', async () => {
    const underChangedPage = makeConnection('user_1');
    const elsewhere = makeConnection('user_1');
    const { extension, spaceMemberRepo } = await makeExtension(
      { user_1: undefined },
      { 'page.child_page': [underChangedPage], 'page.other_page': [elsewhere] },
    );

    await extension.recheckAccess({ pageIds: ['page_1'] });

    expect(underChangedPage.close).toHaveBeenCalledWith(Forbidden);
    expect(elsewhere.close).not.toHaveBeenCalled();
    expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledWith(
      'user_1',
      'space_1',
      { skipCache: true },
    );
  });

  it('rechecks when an access message arrives on the channel', async () => {
    const removed = makeConnection('user_removed');
    const { subscriber } = await makeExtension(
      { user_removed: undefined },
      { 'page.page_1': [removed] },
    );
    const handler = (name: string) =>
      subscriber.on.mock.calls.find(([event]) => event === name)[1];

    expect(subscriber.on).toHaveBeenCalledWith('error', expect.any(Function));
    handler('ready')();
    handler('ready')();
    expect(subscriber.subscribe).toHaveBeenCalledTimes(2);
    expect(subscriber.subscribe).toHaveBeenCalledWith(
      COLLAB_ACCESS_RECHECK_CHANNEL,
    );
    const onMessage = handler('message');
    await onMessage(
      COLLAB_ACCESS_RECHECK_CHANNEL,
      JSON.stringify({ userIds: ['user_removed'] }),
    );

    expect(removed.close).toHaveBeenCalledWith(Forbidden);
  });

  it('keeps rechecking after one connection fails', async () => {
    const broken = makeConnection('user_broken');
    const removed = makeConnection('user_removed');
    const { extension } = await makeExtension(
      { user_removed: undefined },
      { 'page.page_1': [broken, removed] },
    );

    await extension.recheckAccess({ userIds: ['user_broken', 'user_removed'] });

    expect(broken.close).not.toHaveBeenCalled();
    expect(removed.close).toHaveBeenCalledWith(Forbidden);
  });
});

describe('AuthenticationExtension onAuthenticate', () => {
  it('checks permissions without the cache', async () => {
    const { extension, spaceMemberRepo, pagePermissionRepo } =
      await makeExtension({ user_reader: READER });

    await extension.onAuthenticate({
      documentName: 'page.page_1',
      token: 'user_reader',
      connectionConfig: { readOnly: false },
    } as any);

    expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledWith(
      'user_reader',
      'space_1',
      { skipCache: true },
    );
    expect(pagePermissionRepo.canUserEditPage).toHaveBeenCalledWith(
      'user_reader',
      'page_1',
      { skipCache: true },
    );
  });

  it('opens readers read-only and rejects users without access', async () => {
    const { extension } = await makeExtension({
      user_reader: READER,
      user_none: undefined,
    });
    const payload = (token: string) =>
      ({
        documentName: 'page.page_1',
        token,
        connectionConfig: { readOnly: false },
      }) as any;

    const readerPayload = payload('user_reader');
    await extension.onAuthenticate(readerPayload);
    expect(readerPayload.connectionConfig.readOnly).toBe(true);

    await expect(extension.onAuthenticate(payload('user_none'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects pages from another workspace', async () => {
    const { extension, spaceMemberRepo } = await makeExtension({
      user_writer: WRITER,
    });

    await expect(
      extension.onAuthenticate({
        documentName: 'page.page_other_ws',
        token: 'user_writer',
        connectionConfig: { readOnly: false },
      } as any),
    ).rejects.toThrow(NotFoundException);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
  });
});
