import { BadRequestException } from '@nestjs/common';
import { PageService } from './page.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const SPACE_ID = '019a1f00-0000-7000-8000-000000000002';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const OTHER_PAGE_ID = '019a1f00-0000-7000-8000-000000000004';
const USER_ID = '019a1f00-0000-7000-8000-000000000005';
const ATTACHMENT_ID = '019a1f00-0000-7000-8000-0000000000aa';

const user = { id: USER_ID, workspaceId: WORKSPACE_ID } as any;

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGE_ID,
    slugId: 'pageSlug01',
    title: 'Roadmap',
    icon: null,
    coverPhoto: null,
    coverPosition: null,
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
    contributorIds: [],
    ...overrides,
  } as any;
}

function makeAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    type: 'file',
    fileName: 'team-offsite.jpg',
    filePath: `${WORKSPACE_ID}/files/${ATTACHMENT_ID}/team-offsite.jpg`,
    fileSize: 1024,
    fileExt: '.jpg',
    mimeType: 'image/jpeg',
    pageId: PAGE_ID,
    spaceId: SPACE_ID,
    workspaceId: WORKSPACE_ID,
    creatorId: USER_ID,
    aiChatId: null,
    ...overrides,
  };
}

function makeService(attachment: unknown = null) {
  const pageRepo = {
    updatePage: jest.fn(async () => undefined),
    findById: jest.fn(async () => makePage()),
  };
  const attachmentRepo = {
    findById: jest.fn(async () => attachment),
  };
  const generalQueue = { add: jest.fn(async () => undefined) };

  const service = new PageService(
    pageRepo as any,
    {} as any,
    attachmentRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    generalQueue as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const savedFields = () => (pageRepo.updatePage.mock.calls[0] as any[])[0];

  return { service, pageRepo, attachmentRepo, savedFields };
}

describe('PageService.update cover', () => {
  it('stores a preset cover and recenters it', async () => {
    const { service, savedFields } = makeService();
    const page = makePage({ coverPhoto: 'preset:color-red', coverPosition: 20 });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: 'preset:gradient-aurora' } as any,
      user,
    );

    expect(savedFields()).toMatchObject({
      coverPhoto: 'preset:gradient-aurora',
      coverPosition: null,
    });
  });

  it('stores an image attachment of the same page under its canonical path', async () => {
    const { service, attachmentRepo, savedFields } = makeService(makeAttachment());

    await service.update(
      makePage(),
      {
        pageId: PAGE_ID,
        coverPhoto: `/api/files/${ATTACHMENT_ID}/renamed-by-client.jpg`,
      } as any,
      user,
    );

    expect(attachmentRepo.findById).toHaveBeenCalledWith(ATTACHMENT_ID);
    expect(savedFields().coverPhoto).toBe(
      `/api/files/${ATTACHMENT_ID}/team-offsite.jpg`,
    );
  });

  it.each([
    ['an external URL', 'https://tracker.example/pixel.png', null],
    ['a malformed preset', 'preset:../../etc', null],
    [
      'an attachment of another page',
      `/api/files/${ATTACHMENT_ID}/cover.jpg`,
      makeAttachment({ pageId: OTHER_PAGE_ID }),
    ],
    [
      'an attachment of another workspace',
      `/api/files/${ATTACHMENT_ID}/cover.jpg`,
      makeAttachment({ workspaceId: '019a1f00-0000-7000-8000-0000000000ff' }),
    ],
    [
      'a non-image attachment',
      `/api/files/${ATTACHMENT_ID}/notes.pdf`,
      makeAttachment({ fileName: 'notes.pdf', mimeType: 'application/pdf' }),
    ],
    [
      'an svg attachment',
      `/api/files/${ATTACHMENT_ID}/logo.svg`,
      makeAttachment({ fileName: 'logo.svg', mimeType: 'image/svg+xml' }),
    ],
    [
      'a missing attachment',
      `/api/files/${ATTACHMENT_ID}/cover.jpg`,
      null,
    ],
  ])('rejects %s', async (_label, coverPhoto, attachment) => {
    const { service, pageRepo } = makeService(attachment);

    await expect(
      service.update(makePage(), { pageId: PAGE_ID, coverPhoto } as any, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pageRepo.updatePage).not.toHaveBeenCalled();
  });

  it('removes the cover and its position', async () => {
    const { service, savedFields } = makeService();
    const page = makePage({ coverPhoto: 'preset:color-red', coverPosition: 35 });

    await service.update(page, { pageId: PAGE_ID, coverPhoto: null } as any, user);

    expect(savedFields()).toMatchObject({ coverPhoto: null, coverPosition: null });
  });

  it('keeps the saved position when the same cover is sent again', async () => {
    const { service, savedFields } = makeService();
    const page = makePage({
      coverPhoto: 'preset:gradient-aurora',
      coverPosition: 35,
    });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: 'preset:gradient-aurora' } as any,
      user,
    );

    expect(savedFields().coverPosition).toBeUndefined();
  });

  it('keeps the saved position when the same upload is sent under another name', async () => {
    const { service, savedFields } = makeService(makeAttachment());
    const page = makePage({
      coverPhoto: `/api/files/${ATTACHMENT_ID}/team-offsite.jpg`,
      coverPosition: 35,
    });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: `/api/files/${ATTACHMENT_ID}/other-name.jpg` } as any,
      user,
    );

    expect(savedFields().coverPhoto).toBe(
      `/api/files/${ATTACHMENT_ID}/team-offsite.jpg`,
    );
    expect(savedFields().coverPosition).toBeUndefined();
  });

  it('saves a new position without touching the cover', async () => {
    const { service, savedFields } = makeService();
    const page = makePage({ coverPhoto: 'preset:gradient-aurora' });

    await service.update(page, { pageId: PAGE_ID, coverPosition: 30 } as any, user);

    expect(savedFields().coverPosition).toBe(30);
    expect(savedFields().coverPhoto).toBeUndefined();
  });

  it('uses the position sent with a new cover', async () => {
    const { service, savedFields } = makeService();

    await service.update(
      makePage(),
      { pageId: PAGE_ID, coverPhoto: 'preset:texture-paper', coverPosition: 70 } as any,
      user,
    );

    expect(savedFields()).toMatchObject({
      coverPhoto: 'preset:texture-paper',
      coverPosition: 70,
    });
  });

  it('drops a position sent for a page without a cover', async () => {
    const { service, savedFields } = makeService();

    await service.update(makePage(), { pageId: PAGE_ID, coverPosition: 40 } as any, user);

    expect(savedFields().coverPosition).toBeNull();
  });

  it('leaves the cover alone on a title update', async () => {
    const { service, savedFields } = makeService();
    const page = makePage({ coverPhoto: 'preset:color-red', coverPosition: 35 });

    await service.update(page, { pageId: PAGE_ID, title: 'New title' } as any, user);

    expect(savedFields().title).toBe('New title');
    expect(savedFields().coverPhoto).toBeUndefined();
    expect(savedFields().coverPosition).toBeUndefined();
  });
});
