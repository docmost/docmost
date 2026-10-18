import { Forbidden } from '@hocuspocus/common';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthenticationExtension } from './authentication.extension';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';
import { buildApprovalState } from '../../core/page/approval/page-approval.utils';
import { ApprovalState } from '../../core/page/approval/page-approval.types';

const WRITER = [{ userId: 'any', role: 'writer' }];
const READER = [{ userId: 'any', role: 'reader' }];
const NO_ACCESS = JSON.stringify({ type: 'page.permissions', access: 'none' });
const READ_ACCESS = JSON.stringify({ type: 'page.permissions', access: 'read' });

const PAGE_1 = '01a14cce-0000-7000-8000-000000000001';
const PAGE_OTHER_WS = '01a14cce-0000-7000-8000-000000000002';
const PAGE_SPACE_2 = '01a14cce-0000-7000-8000-000000000003';

const UNCONTROLLED = buildApprovalState({ isBase: false });
const PUBLISHED = buildApprovalState({
  isBase: false,
  verificationId: 'verification_1',
  verificationType: 'qms',
  verificationStatus: 'approved',
  readerVersionId: 'history_1',
});
const IN_REVIEW = buildApprovalState({
  isBase: false,
  verificationId: 'verification_1',
  verificationType: 'qms',
  verificationStatus: 'in_approval',
  readerVersionId: 'history_1',
});

type ApprovalMock = {
  state?: ApprovalState;
  hiddenUserIds?: string[];
  draftUserIds?: string[];
};

function makeConnection(userId: string, readOnly = false) {
  return {
    context: { user: { id: userId, workspaceId: 'ws_1' } },
    readOnly,
    close: jest.fn(),
    sendStateless: jest.fn(),
  };
}

function spaceOf(pageId: string) {
  return pageId === PAGE_SPACE_2 ? 'space_2' : 'space_1';
}

async function makeExtension(
  spaceRoles: Record<string, unknown[] | undefined>,
  documents: Record<string, ReturnType<typeof makeConnection>[]> = {},
  approval: ApprovalMock = {},
) {
  const subscriber = {
    on: jest.fn(),
    subscribe: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  };
  const tokenService = {
    verifyJwt: jest.fn(async (token: string) => ({
      sub: token,
      workspaceId: 'ws_1',
    })),
  };
  const userRepo = {
    findById: jest.fn(async (id: string) => {
      if (id === 'user_broken') throw new Error('db down');
      return { id, workspaceId: 'ws_1' };
    }),
  };
  const pageRepo = {
    findById: jest.fn(async (id: string) => ({
      id,
      spaceId: spaceOf(id),
      workspaceId: id === PAGE_OTHER_WS ? 'ws_2' : 'ws_1',
      isBase: false,
      deletedAt: null,
    })),
    findManyByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ id, spaceId: spaceOf(id) })),
    ),
    getPageAndDescendants: jest.fn(async (id: string) => [
      { id },
      { id: 'child_page' },
    ]),
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
  const pageApprovalService = {
    getState: jest.fn(async () => approval.state ?? UNCONTROLLED),
    isHiddenFromUser: jest.fn(
      async (userId: string) => approval.hiddenUserIds?.includes(userId) ?? false,
    ),
    canAccessDraft: jest.fn(
      async (user: { id: string }) =>
        approval.draftUserIds?.includes(user.id) ?? false,
    ),
  };
  const extension = new AuthenticationExtension(
    tokenService as any,
    userRepo as any,
    pageRepo as any,
    spaceMemberRepo as any,
    pagePermissionRepo as any,
    pageApprovalService as any,
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
  return {
    extension,
    subscriber,
    tokenService,
    userRepo,
    pageRepo,
    spaceMemberRepo,
    pagePermissionRepo,
    pageApprovalService,
  };
}

function authPayload(token: string, documentName = `page.${PAGE_1}`) {
  return {
    documentName,
    token,
    connectionConfig: { readOnly: false },
  } as any;
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

  it('rechecks open documents of pages in the changed spaces only', async () => {
    const inChangedSpace = makeConnection('user_1');
    const inOtherSpace = makeConnection('user_1');
    const { extension, pageRepo } = await makeExtension(
      { user_1: undefined },
      {
        [`page.${PAGE_1}`]: [inChangedSpace],
        [`page.${PAGE_SPACE_2}`]: [inOtherSpace],
      },
    );

    await extension.recheckAccess({ spaceIds: ['space_1'] });

    expect(inChangedSpace.close).toHaveBeenCalledWith(Forbidden);
    expect(inOtherSpace.close).not.toHaveBeenCalled();
    expect(pageRepo.findManyByIds).toHaveBeenCalledWith([PAGE_1, PAGE_SPACE_2]);
  });

  it('closes reader connections when the page becomes approval-controlled', async () => {
    const reader = makeConnection('user_reader', true);
    const editor = makeConnection('user_writer');
    const { extension } = await makeExtension(
      { user_reader: READER, user_writer: WRITER },
      { [`page.${PAGE_1}`]: [reader, editor] },
      { state: PUBLISHED, draftUserIds: ['user_writer'] },
    );

    await extension.recheckAccess({ pageIds: [PAGE_1] });

    expect(reader.sendStateless).toHaveBeenCalledWith(NO_ACCESS);
    expect(reader.close).toHaveBeenCalledWith(Forbidden);
    expect(editor.sendStateless).not.toHaveBeenCalled();
    expect(editor.close).not.toHaveBeenCalled();
    expect(editor.readOnly).toBe(false);
  });

  it('makes editors read-only when the page is locked for review', async () => {
    const editor = makeConnection('user_writer');
    const { extension } = await makeExtension(
      { user_writer: WRITER },
      { [`page.${PAGE_1}`]: [editor] },
      { state: IN_REVIEW, draftUserIds: ['user_writer'] },
    );

    await extension.recheckAccess({ pageIds: [PAGE_1] });

    expect(editor.readOnly).toBe(true);
    expect(editor.sendStateless).toHaveBeenCalledWith(READ_ACCESS);
    expect(editor.close).not.toHaveBeenCalled();
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

    await extension.onAuthenticate(authPayload('user_reader'));

    expect(spaceMemberRepo.getUserSpaceRoles).toHaveBeenCalledWith(
      'user_reader',
      'space_1',
      { skipCache: true },
    );
    expect(pagePermissionRepo.canUserEditPage).toHaveBeenCalledWith(
      'user_reader',
      PAGE_1,
      { skipCache: true },
    );
  });

  it('opens readers read-only and rejects users without access', async () => {
    const { extension } = await makeExtension({
      user_reader: READER,
      user_none: undefined,
    });

    const readerPayload = authPayload('user_reader');
    await extension.onAuthenticate(readerPayload);
    expect(readerPayload.connectionConfig.readOnly).toBe(true);

    await expect(
      extension.onAuthenticate(authPayload('user_none')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects pages from another workspace', async () => {
    const { extension, spaceMemberRepo } = await makeExtension({
      user_writer: WRITER,
    });

    await expect(
      extension.onAuthenticate(
        authPayload('user_writer', `page.${PAGE_OTHER_WS}`),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(spaceMemberRepo.getUserSpaceRoles).not.toHaveBeenCalled();
  });

  it('rejects document names other than page.<uuid> before any lookup', async () => {
    const { extension, tokenService, userRepo, pageRepo } =
      await makeExtension({ user_writer: WRITER });

    for (const documentName of [
      `x.${PAGE_1}`,
      'page.Ab12Cd34Ef',
      `page.${PAGE_1}.draft`,
      `page.${PAGE_1.toUpperCase()}`,
    ]) {
      await expect(
        extension.onAuthenticate(authPayload('user_writer', documentName)),
      ).rejects.toThrow(UnauthorizedException);
    }
    expect(tokenService.verifyJwt).not.toHaveBeenCalled();
    expect(userRepo.findById).not.toHaveBeenCalled();
    expect(pageRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects readers of an approval-controlled page', async () => {
    const { extension } = await makeExtension(
      { user_reader: READER },
      {},
      { state: PUBLISHED },
    );

    await expect(
      extension.onAuthenticate(authPayload('user_reader')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('opens approvers who cannot edit read-only on a controlled page', async () => {
    const { extension } = await makeExtension(
      { user_approver: READER },
      {},
      { state: PUBLISHED, draftUserIds: ['user_approver'] },
    );

    const payload = authPayload('user_approver');
    await extension.onAuthenticate(payload);

    expect(payload.connectionConfig.readOnly).toBe(true);
  });

  it('opens editors read-only while the page is in review and writable otherwise', async () => {
    const locked = await makeExtension(
      { user_writer: WRITER },
      {},
      { state: IN_REVIEW, draftUserIds: ['user_writer'] },
    );
    const unlocked = await makeExtension(
      { user_writer: WRITER },
      {},
      { state: PUBLISHED, draftUserIds: ['user_writer'] },
    );

    const lockedPayload = authPayload('user_writer');
    const unlockedPayload = authPayload('user_writer');
    await locked.extension.onAuthenticate(lockedPayload);
    await unlocked.extension.onAuthenticate(unlockedPayload);

    expect(lockedPayload.connectionConfig.readOnly).toBe(true);
    expect(unlockedPayload.connectionConfig.readOnly).toBe(false);
    expect(unlocked.pageApprovalService.canAccessDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_writer' }),
      expect.objectContaining({ id: PAGE_1 }),
      PUBLISHED,
    );
  });

  it('rejects a page hidden from the user by an unpublished ancestor', async () => {
    const { extension, pageApprovalService } = await makeExtension(
      { user_reader: READER },
      {},
      { hiddenUserIds: ['user_reader'] },
    );

    await expect(
      extension.onAuthenticate(authPayload('user_reader')),
    ).rejects.toThrow(UnauthorizedException);
    expect(pageApprovalService.isHiddenFromUser).toHaveBeenCalledWith(
      'user_reader',
      expect.objectContaining({ id: PAGE_1 }),
      UNCONTROLLED,
    );
  });

  it('skips the hidden lookup for users with draft access', async () => {
    const { extension, pageApprovalService } = await makeExtension(
      { user_writer: WRITER },
      {},
      {
        state: PUBLISHED,
        draftUserIds: ['user_writer'],
        hiddenUserIds: ['user_writer'],
      },
    );

    const payload = authPayload('user_writer');
    await extension.onAuthenticate(payload);

    expect(payload.connectionConfig.readOnly).toBe(false);
    expect(pageApprovalService.isHiddenFromUser).not.toHaveBeenCalled();
  });

  it('skips the draft access lookup on an uncontrolled page', async () => {
    const { extension, pageApprovalService } = await makeExtension({
      user_writer: WRITER,
    });

    const payload = authPayload('user_writer');
    await extension.onAuthenticate(payload);

    expect(payload.connectionConfig.readOnly).toBe(false);
    expect(pageApprovalService.canAccessDraft).not.toHaveBeenCalled();
  });
});
