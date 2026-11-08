import {
  getCoverAttachmentId,
  isPresetCover,
  remapCopiedCover,
} from './page-cover.utils';
import { ICopyPageAttachment } from './dto/duplicate-page.dto';

const ATTACHMENT_ID = '019a1f00-0000-7000-8000-0000000000aa';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000001';
const PAGE_COPY_ID = '019a1f00-0000-7000-8000-000000000101';
const OTHER_PAGE_ID = '019a1f00-0000-7000-8000-000000000002';
const OTHER_PAGE_COPY_ID = '019a1f00-0000-7000-8000-000000000102';
const COPY_ID = '019a1f00-0000-7000-8000-0000000000bb';

describe('remapCopiedCover', () => {
  const pages = { oldPageId: PAGE_ID, newPageId: PAGE_COPY_ID };
  const newId = () => COPY_ID;

  it('keeps a preset cover and copies nothing', () => {
    const attachments = new Map<string, ICopyPageAttachment>();

    expect(
      remapCopiedCover('preset:gradient-dusk', pages, attachments, newId),
    ).toBe('preset:gradient-dusk');
    expect(attachments.size).toBe(0);
  });

  it('points an uploaded cover at a new copy of its file', () => {
    const attachments = new Map<string, ICopyPageAttachment>();

    expect(
      remapCopiedCover(
        `/api/files/${ATTACHMENT_ID}/offsite.jpg`,
        pages,
        attachments,
        newId,
      ),
    ).toBe(`/api/files/${COPY_ID}/offsite.jpg`);
    expect(attachments.get(ATTACHMENT_ID)).toEqual({
      oldAttachmentId: ATTACHMENT_ID,
      newAttachmentId: COPY_ID,
      oldPageId: PAGE_ID,
      newPageId: PAGE_COPY_ID,
    });
  });

  it('reuses the copy made for the same image in the page content', () => {
    const attachments = new Map<string, ICopyPageAttachment>([
      [
        ATTACHMENT_ID,
        {
          oldAttachmentId: ATTACHMENT_ID,
          newAttachmentId: 'content-copy-id',
          oldPageId: PAGE_ID,
          newPageId: PAGE_COPY_ID,
        },
      ],
    ]);

    expect(
      remapCopiedCover(
        `/api/files/${ATTACHMENT_ID}/offsite.jpg`,
        pages,
        attachments,
        newId,
      ),
    ).toBe('/api/files/content-copy-id/offsite.jpg');
  });

  it('keeps the file with the cover page when another page also shows it', () => {
    const attachments = new Map<string, ICopyPageAttachment>([
      [
        ATTACHMENT_ID,
        {
          oldAttachmentId: ATTACHMENT_ID,
          newAttachmentId: 'content-copy-id',
          oldPageId: OTHER_PAGE_ID,
          newPageId: OTHER_PAGE_COPY_ID,
        },
      ],
    ]);

    remapCopiedCover(
      `/api/files/${ATTACHMENT_ID}/offsite.jpg`,
      pages,
      attachments,
      newId,
    );

    expect(attachments.get(ATTACHMENT_ID)).toEqual({
      oldAttachmentId: ATTACHMENT_ID,
      newAttachmentId: 'content-copy-id',
      oldPageId: PAGE_ID,
      newPageId: PAGE_COPY_ID,
    });
  });
});

describe('isPresetCover', () => {
  it.each([
    ['preset:gradient-aurora', true],
    ['preset:color-red', true],
    ['preset:', false],
    ['preset:Gradient', false],
    ['preset:gradient aurora', false],
    ['https://example.com/cover.png', false],
    [`/api/files/${ATTACHMENT_ID}/cover.jpg`, false],
  ])('%s -> %s', (value, expected) => {
    expect(isPresetCover(value)).toBe(expected);
  });
});

describe('getCoverAttachmentId', () => {
  it.each([
    [`/api/files/${ATTACHMENT_ID}/cover.jpg`, ATTACHMENT_ID],
    [`/api/files/${ATTACHMENT_ID}/my cover (1).png`, ATTACHMENT_ID],
    [`/api/files/${ATTACHMENT_ID}/cover.jpg?x=1`, null],
    [`/api/files/${ATTACHMENT_ID}/`, null],
    [`/api/files/not-a-uuid/cover.jpg`, null],
    [`https://evil.example/api/files/${ATTACHMENT_ID}/cover.jpg`, null],
    [`/files/${ATTACHMENT_ID}/cover.jpg`, null],
    ['preset:gradient-aurora', null],
    [null, null],
    [undefined, null],
  ])('%s -> %s', (value, expected) => {
    expect(getCoverAttachmentId(value)).toBe(expected);
  });
});
