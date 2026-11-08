import { AttachmentService } from './attachment.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const OTHER_PAGE_ID = '019a1f00-0000-7000-8000-000000000004';
const ATTACHMENT_ID = '019a1f00-0000-7000-8000-0000000000aa';
const COVER = `/api/files/${ATTACHMENT_ID}/team-offsite.jpg`;

const attachment = {
  id: ATTACHMENT_ID,
  type: 'page-cover',
  pageId: PAGE_ID,
  workspaceId: WORKSPACE_ID,
  filePath: `${WORKSPACE_ID}/files/${ATTACHMENT_ID}/team-offsite.jpg`,
};

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGE_ID,
    coverPhoto: 'preset:gradient-aurora',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    ...overrides,
  };
}

function makeService(setup: { attachment: unknown; page: unknown }) {
  const storageService = { delete: jest.fn(async () => undefined) };
  const attachmentRepo = {
    findById: jest.fn(async () => setup.attachment),
    deleteAttachmentById: jest.fn(async () => undefined),
  };
  const pageRepo = { findById: jest.fn(async () => setup.page) };

  const service = new AttachmentService(
    storageService as any,
    attachmentRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    pageRepo as any,
  );

  return { service, storageService, attachmentRepo, pageRepo };
}

describe('AttachmentService.handleDeleteUnusedCover', () => {
  const job = { pageId: PAGE_ID, attachmentId: ATTACHMENT_ID };

  it('deletes a cover upload its page no longer uses', async () => {
    const { service, storageService, attachmentRepo, pageRepo } = makeService({
      attachment,
      page: makePage(),
    });

    await service.handleDeleteUnusedCover(job);

    expect(pageRepo.findById).toHaveBeenCalledWith(PAGE_ID, {
      includeContent: true,
    });
    expect(storageService.delete).toHaveBeenCalledWith(attachment.filePath);
    expect(attachmentRepo.deleteAttachmentById).toHaveBeenCalledWith(
      ATTACHMENT_ID,
    );
  });

  it.each([
    ['is the cover again', { attachment, page: makePage({ coverPhoto: COVER }) }],
    [
      'is shown in the page content',
      {
        attachment,
        page: makePage({
          content: {
            type: 'doc',
            content: [
              { type: 'image', attrs: { src: COVER, attachmentId: ATTACHMENT_ID } },
            ],
          },
        }),
      },
    ],
    [
      'belongs to another page',
      { attachment: { ...attachment, pageId: OTHER_PAGE_ID }, page: makePage() },
    ],
    [
      'was not uploaded as a cover',
      { attachment: { ...attachment, type: 'file' }, page: makePage() },
    ],
    ['is already gone', { attachment: null, page: makePage() }],
    ['has no page left', { attachment, page: null }],
  ])('keeps the file when it %s', async (_label, setup) => {
    const { service, storageService, attachmentRepo } = makeService(setup);

    await service.handleDeleteUnusedCover(job);

    expect(storageService.delete).not.toHaveBeenCalled();
    expect(attachmentRepo.deleteAttachmentById).not.toHaveBeenCalled();
  });
});
