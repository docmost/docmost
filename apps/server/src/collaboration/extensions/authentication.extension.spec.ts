import { Forbidden } from '@hocuspocus/common';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationExtension } from './authentication.extension';
import { CacheKey } from '../../common/helpers/cache-keys';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

const WRITER = [{ userId: 'any', role: 'writer' }];
const READER = [{ userId: 'any', role: 'reader' }];
const PERMISSIONS_CHANGED = JSON.stringify({ type: 'page.permissions' });

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
  const cacheManager = { del: jest.fn(async () => undefined) };
  const extension = new AuthenticationExtension(
    { verifyJwt: jest.fn(async (token: string) => ({ sub: token, workspaceId: 'ws_1' })) } as any,
    { findById: jest.fn(async (id: string) => ({ id, workspaceId: 'ws_1' })) } as any,
    {
      findById: jest.fn(async (id: string) => ({ id, spaceId: 'space_1', deletedAt: null })),
      getPageAndDescendants: jest.fn(async (id: string) => [{ id }, { id: 'child_page' }]),
    } as any,
    { getUserSpaceRoles: jest.fn(async (userId: string) => spaceRoles[userId]) } as any,
    {
      canUserEditPage: jest.fn(async () => ({
        hasAnyRestriction: false,
        canAccess: true,
        canEdit: true,
      })),
    } as any,
    { getOrThrow: () => ({ duplicate: () => subscriber }) } as any,
    cacheManager as any,
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
  return { extension, subscriber, cacheManager };
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

    expect(removed.sendStateless).toHaveBeenCalledWith(PERMISSIONS_CHANGED);
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
    expect(downgraded.sendStateless).toHaveBeenCalledWith(PERMISSIONS_CHANGED);
    expect(downgraded.close).not.toHaveBeenCalled();
  });

  it('rechecks connections on pages under a changed page only', async () => {
    const underChangedPage = makeConnection('user_1');
    const elsewhere = makeConnection('user_1');
    const { extension, cacheManager } = await makeExtension(
      { user_1: undefined },
      { 'page.child_page': [underChangedPage], 'page.other_page': [elsewhere] },
    );

    await extension.recheckAccess({ pageIds: ['page_1'] });

    expect(underChangedPage.close).toHaveBeenCalledWith(Forbidden);
    expect(elsewhere.close).not.toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalledWith(
      CacheKey.SPACE_ROLES('user_1', 'space_1'),
    );
    expect(cacheManager.del).toHaveBeenCalledWith(
      CacheKey.PAGE_CAN_EDIT('user_1', 'child_page'),
    );
  });

  it('rechecks when an access message arrives on the channel', async () => {
    const removed = makeConnection('user_removed');
    const { subscriber } = await makeExtension(
      { user_removed: undefined },
      { 'page.page_1': [removed] },
    );

    expect(subscriber.subscribe).toHaveBeenCalledWith(
      COLLAB_ACCESS_RECHECK_CHANNEL,
    );
    const onMessage = subscriber.on.mock.calls[0][1];
    await onMessage(
      COLLAB_ACCESS_RECHECK_CHANNEL,
      JSON.stringify({ userIds: ['user_removed'] }),
    );

    expect(removed.close).toHaveBeenCalledWith(Forbidden);
  });
});

describe('AuthenticationExtension onAuthenticate', () => {
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
});
