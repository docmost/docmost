import { BadRequestException } from '@nestjs/common';
import { PageService } from './page.service';
import { QueueJob } from '../../../integrations/queue/constants';
import { COVER_CLEANUP_DELAY_MS } from '../page-cover.constants';

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
    type: 'page-cover',
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

const UNSPLASH_URL =
  'https://images.unsplash.com/photo-1?ixid=abc&w=2560&q=80&auto=format&fit=max';
const UNSPLASH_CREDIT = {
  source: 'unsplash',
  photoId: 'Abc_123',
  authorName: 'Ada Lovelace',
  authorUsername: 'ada',
};
const UPLOADED_COVER = `/api/files/${ATTACHMENT_ID}/team-offsite.jpg`;

function makeService(attachment: unknown = null) {
  const pageRepo = {
    updatePage: jest.fn(async () => undefined),
    findById: jest.fn(async () => makePage()),
  };
  const attachmentRepo = {
    findById: jest.fn(async () => attachment),
  };
  const attachmentQueue = {
    add: jest.fn(async () => undefined),
    remove: jest.fn(async () => 1),
  };
  const generalQueue = { add: jest.fn(async () => undefined) };
  const unsplashService = {
    getCover: jest.fn(async () => ({
      coverPhoto: UNSPLASH_URL,
      coverAttribution: UNSPLASH_CREDIT,
    })),
  };

  const service = new PageService(
    pageRepo as any,
    {} as any,
    attachmentRepo as any,
    {} as any,
    {} as any,
    attachmentQueue as any,
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
    unsplashService as any,
  );

  const savedFields = () => (pageRepo.updatePage.mock.calls[0] as any[])[0];

  return {
    service,
    pageRepo,
    attachmentRepo,
    attachmentQueue,
    unsplashService,
    savedFields,
  };
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
      'a page file that was not uploaded as a cover',
      `/api/files/${ATTACHMENT_ID}/team-offsite.jpg`,
      makeAttachment({ type: 'file' }),
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

describe('PageService.update Unsplash cover', () => {
  it('stores the photo Unsplash returns, with its credit', async () => {
    const { service, unsplashService, savedFields } = makeService();
    const page = makePage({ coverPhoto: 'preset:color-red', coverPosition: 20 });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: 'unsplash:Abc_123' } as any,
      user,
    );

    expect(unsplashService.getCover).toHaveBeenCalledWith('Abc_123', USER_ID);
    expect(savedFields()).toMatchObject({
      coverPhoto: UNSPLASH_URL,
      coverAttribution: UNSPLASH_CREDIT,
      coverPosition: null,
    });
  });

  it('drops the credit when another cover replaces the photo', async () => {
    const { service, savedFields } = makeService();
    const page = makePage({
      coverPhoto: UNSPLASH_URL,
      coverAttribution: UNSPLASH_CREDIT,
    });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: 'preset:gradient-aurora' } as any,
      user,
    );

    expect(savedFields()).toMatchObject({
      coverPhoto: 'preset:gradient-aurora',
      coverAttribution: null,
    });
  });

  it('accepts the current photo sent back unchanged', async () => {
    const { service, unsplashService, savedFields } = makeService();
    const page = makePage({
      coverPhoto: UNSPLASH_URL,
      coverAttribution: UNSPLASH_CREDIT,
      coverPosition: 35,
    });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: UNSPLASH_URL } as any,
      user,
    );

    expect(unsplashService.getCover).not.toHaveBeenCalled();
    expect(savedFields().coverPhoto).toBeUndefined();
    expect(savedFields().coverAttribution).toBeUndefined();
    expect(savedFields().coverPosition).toBeUndefined();
  });

  it.each([
    ['an Unsplash address sent directly', UNSPLASH_URL],
    ['a malformed photo id', 'unsplash:../photos'],
  ])('rejects %s', async (_label, coverPhoto) => {
    const { service, unsplashService, pageRepo } = makeService();

    await expect(
      service.update(makePage(), { pageId: PAGE_ID, coverPhoto } as any, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(unsplashService.getCover).not.toHaveBeenCalled();
    expect(pageRepo.updatePage).not.toHaveBeenCalled();
  });

  it('passes on an Unsplash error and saves nothing', async () => {
    const { service, unsplashService, pageRepo } = makeService();
    unsplashService.getCover.mockRejectedValueOnce(
      new BadRequestException('Unsplash is not enabled'),
    );

    await expect(
      service.update(
        makePage(),
        { pageId: PAGE_ID, coverPhoto: 'unsplash:Abc_123' } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pageRepo.updatePage).not.toHaveBeenCalled();
  });
});

describe('PageService.update cover cleanup', () => {
  const cleanupJobs = (attachmentQueue: { add: jest.Mock }) =>
    attachmentQueue.add.mock.calls.filter(
      ([name]) => name === QueueJob.DELETE_UNUSED_COVER,
    );

  it.each([
    ['replaced by a preset', 'preset:gradient-aurora'],
    ['replaced by an Unsplash photo', 'unsplash:Abc_123'],
    ['removed', null],
  ])('schedules an upload %s for deletion', async (_label, coverPhoto) => {
    const { service, attachmentQueue } = makeService();
    const page = makePage({ coverPhoto: UPLOADED_COVER });

    await service.update(page, { pageId: PAGE_ID, coverPhoto } as any, user);

    // a newer schedule replaces an older one, so the delay restarts
    const jobId = `cover-cleanup-${ATTACHMENT_ID}`;
    expect(attachmentQueue.remove).toHaveBeenCalledWith(jobId);
    expect(cleanupJobs(attachmentQueue)).toEqual([
      [
        QueueJob.DELETE_UNUSED_COVER,
        { pageId: PAGE_ID, attachmentId: ATTACHMENT_ID },
        expect.objectContaining({ jobId, delay: COVER_CLEANUP_DELAY_MS }),
      ],
    ]);
  });

  it('keeps an upload sent again under another name', async () => {
    const { service, attachmentQueue } = makeService(makeAttachment());
    const page = makePage({ coverPhoto: UPLOADED_COVER });

    await service.update(
      page,
      { pageId: PAGE_ID, coverPhoto: `/api/files/${ATTACHMENT_ID}/x.jpg` } as any,
      user,
    );

    expect(cleanupJobs(attachmentQueue)).toEqual([]);
  });

  it('schedules nothing when the old cover was not an upload', async () => {
    const { service, attachmentQueue } = makeService();
    const page = makePage({ coverPhoto: 'preset:color-red' });

    await service.update(page, { pageId: PAGE_ID, coverPhoto: null } as any, user);

    expect(cleanupJobs(attachmentQueue)).toEqual([]);
  });

  it('schedules nothing when the cover is left alone', async () => {
    const { service, attachmentQueue } = makeService();
    const page = makePage({ coverPhoto: UPLOADED_COVER });

    await service.update(page, { pageId: PAGE_ID, coverPosition: 20 } as any, user);

    expect(cleanupJobs(attachmentQueue)).toEqual([]);
  });
});
