import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';

const DISABLED = 'HTML blocks are disabled in this workspace';
const NOT_FOUND = 'HTML block not found';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000060';
const OTHER_WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000061';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000062';
const OTHER_SPACE_ID = '019a1f00-0000-7000-8000-000000000063';
const SHARE_ID = '019a1f00-0000-7000-8000-000000000064';
const SHARED_PAGE_ID = '019a1f00-0000-7000-8000-000000000065';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000066';
const TEMPLATE_ID = '019a1f00-0000-7000-8000-000000000067';
const HTML_BLOCK_ID = '019a1f00-0000-7000-8000-000000000068';
const CREATED_AT = new Date('2026-11-21T10:00:00.000Z');

function workspace(htmlBlocks?: { enabled?: boolean }) {
  return {
    id: WORKSPACE_ID,
    settings: htmlBlocks ? { htmlBlocks } : {},
  } as any;
}

const enabled = workspace({ enabled: true });

function share(overrides: Record<string, unknown> = {}) {
  return {
    id: SHARE_ID,
    key: 'k7m2p9',
    pageId: SHARED_PAGE_ID,
    includeSubPages: true,
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
    ...overrides,
  };
}

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: HTML_BLOCK_ID,
    workspaceId: WORKSPACE_ID,
    pageId: PAGE_ID,
    templateId: null,
    content: '<p>Opening hours</p>',
    creatorId: '019a1f00-0000-7000-8000-000000000069',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

async function expectRejection(
  promise: Promise<unknown>,
  type: new (...args: any[]) => Error,
  message: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(type);
  await expect(promise).rejects.toThrow(new Error(message));
}

function buildService() {
  const shareRepo = { findById: jest.fn().mockResolvedValue(share()) };
  const pagePermissionRepo = {
    hasRestrictedAncestor: jest.fn().mockResolvedValue(false),
  };
  const htmlBlockRepo = { findById: jest.fn().mockResolvedValue(block()) };
  const service = new ShareService(
    shareRepo as any,
    {} as any,
    pagePermissionRepo as any,
    {} as any,
    {} as any,
    {} as any,
    htmlBlockRepo as any,
  );
  const getShareForPage = jest
    .spyOn(service, 'getShareForPage')
    .mockResolvedValue({ id: SHARE_ID, spaceId: SPACE_ID } as any);
  const isSharingAllowed = jest
    .spyOn(service, 'isSharingAllowed')
    .mockResolvedValue(true);
  return {
    service,
    shareRepo,
    pagePermissionRepo,
    htmlBlockRepo,
    getShareForPage,
    isSharingAllowed,
  };
}

describe('ShareService.getHtmlBlockForShare', () => {
  it('returns content for a shared page', async () => {
    const { service, htmlBlockRepo, getShareForPage, pagePermissionRepo } =
      buildService();

    await expect(
      service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, enabled),
    ).resolves.toEqual({
      id: HTML_BLOCK_ID,
      pageId: PAGE_ID,
      templateId: null,
      content: '<p>Opening hours</p>',
      createdAt: CREATED_AT,
    });
    expect(htmlBlockRepo.findById).toHaveBeenCalledWith(
      HTML_BLOCK_ID,
      WORKSPACE_ID,
    );
    expect(getShareForPage).toHaveBeenCalledWith(PAGE_ID, WORKSPACE_ID);
    expect(pagePermissionRepo.hasRestrictedAncestor).toHaveBeenCalledWith(
      PAGE_ID,
    );
  });

  it('refuses when disabled', async () => {
    const { service, htmlBlockRepo } = buildService();

    for (const ws of [workspace(), workspace({ enabled: false })]) {
      await expectRejection(
        service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, ws),
        ForbiddenException,
        DISABLED,
      );
    }
    expect(htmlBlockRepo.findById).not.toHaveBeenCalled();
  });

  it('not found when the page is not shared', async () => {
    const { service, getShareForPage } = buildService();
    getShareForPage.mockResolvedValue(undefined);

    await expectRejection(
      service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, enabled),
      NotFoundException,
      NOT_FOUND,
    );
  });

  it('not found for a template-owned row', async () => {
    const { service, htmlBlockRepo, getShareForPage } = buildService();
    htmlBlockRepo.findById.mockResolvedValue(
      block({ pageId: null, templateId: TEMPLATE_ID }),
    );

    await expectRejection(
      service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, enabled),
      NotFoundException,
      NOT_FOUND,
    );
    expect(getShareForPage).not.toHaveBeenCalled();
  });

  it('not found when the page has a restricted ancestor', async () => {
    const { service, pagePermissionRepo } = buildService();
    pagePermissionRepo.hasRestrictedAncestor.mockResolvedValue(true);

    await expectRejection(
      service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, enabled),
      NotFoundException,
      NOT_FOUND,
    );
  });

  it('not found for a share in another workspace', async () => {
    const { service, shareRepo, htmlBlockRepo } = buildService();
    shareRepo.findById.mockResolvedValue(
      share({ workspaceId: OTHER_WORKSPACE_ID }),
    );

    await expectRejection(
      service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, enabled),
      NotFoundException,
      NOT_FOUND,
    );
    expect(htmlBlockRepo.findById).not.toHaveBeenCalled();
  });

  it('not found when sharing is disabled for the page space', async () => {
    const { service, getShareForPage, isSharingAllowed } = buildService();
    getShareForPage.mockResolvedValue({
      id: SHARE_ID,
      spaceId: OTHER_SPACE_ID,
    } as any);
    isSharingAllowed.mockImplementation(
      async (_workspaceId, spaceId) => spaceId !== OTHER_SPACE_ID,
    );

    await expectRejection(
      service.getHtmlBlockForShare(SHARE_ID, HTML_BLOCK_ID, enabled),
      NotFoundException,
      NOT_FOUND,
    );
    expect(isSharingAllowed).toHaveBeenCalledWith(
      WORKSPACE_ID,
      OTHER_SPACE_ID,
    );
  });
});
