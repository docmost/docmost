import { getCoverAttachmentId, isPresetCover } from './page-cover.utils';

const ATTACHMENT_ID = '019a1f00-0000-7000-8000-0000000000aa';

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
