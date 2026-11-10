import {
  buildCoverFileUrl,
  getCoverAttachmentId,
  getUnsplashPhotoId,
  isPresetCover,
  remapCopiedCover,
} from './page-cover.utils';

const ATTACHMENT_ID = '019a1f00-0000-7000-8000-0000000000aa';
const COPY_ID = '019a1f00-0000-7000-8000-0000000000bb';

describe('buildCoverFileUrl', () => {
  it('encodes the file name so the address stays valid', () => {
    expect(
      buildCoverFileUrl({ id: ATTACHMENT_ID, fileName: '50%_off banner.jpg' }),
    ).toBe(`/api/files/${ATTACHMENT_ID}/50%25_off%20banner.jpg`);
  });
});

describe('remapCopiedCover', () => {
  const newId = () => COPY_ID;

  it('keeps a preset cover and copies nothing', () => {
    const copies = new Map<string, string>();

    expect(remapCopiedCover('preset:gradient-dusk', copies, newId)).toBe(
      'preset:gradient-dusk',
    );
    expect(copies.size).toBe(0);
  });

  it('points an uploaded cover at a new copy of its file', () => {
    const copies = new Map<string, string>();

    expect(
      remapCopiedCover(`/api/files/${ATTACHMENT_ID}/offsite.jpg`, copies, newId),
    ).toBe(`/api/files/${COPY_ID}/offsite.jpg`);
    expect(copies.get(ATTACHMENT_ID)).toBe(COPY_ID);
  });

  it('reuses the copy made for the same image in the page content', () => {
    const copies = new Map([[ATTACHMENT_ID, 'content-copy-id']]);

    expect(
      remapCopiedCover(`/api/files/${ATTACHMENT_ID}/offsite.jpg`, copies, newId),
    ).toBe('/api/files/content-copy-id/offsite.jpg');
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

describe('getUnsplashPhotoId', () => {
  it.each([
    ['unsplash:Abc_123-x', 'Abc_123-x'],
    ['unsplash:', null],
    ['unsplash:../photos', null],
    ['unsplash:abc?w=1', null],
    ['https://images.unsplash.com/photo-1', null],
    ['preset:gradient-aurora', null],
    [null, null],
    [undefined, null],
  ])('%s -> %s', (value, expected) => {
    expect(getUnsplashPhotoId(value)).toBe(expected);
  });
});
