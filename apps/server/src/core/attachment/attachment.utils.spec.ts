import { resolveUploadMode } from './attachment.utils';

const PUBLISHED = { publishedAt: new Date('2026-10-01T00:00:00Z') };
const UNPUBLISHED = { publishedAt: null };

describe('resolveUploadMode', () => {
  it('is new without an existing attachment', () => {
    expect(
      resolveUploadMode({ controlled: false, locked: false, existing: null }),
    ).toBe('new');
  });

  it('is new without an existing attachment on a locked page', () => {
    expect(
      resolveUploadMode({ controlled: true, locked: true, existing: null }),
    ).toBe('new');
  });

  it('replaces an unpublished attachment on an uncontrolled page', () => {
    expect(
      resolveUploadMode({
        controlled: false,
        locked: false,
        existing: UNPUBLISHED,
      }),
    ).toBe('replace');
  });

  it('copies a published attachment on an uncontrolled page', () => {
    expect(
      resolveUploadMode({
        controlled: false,
        locked: false,
        existing: PUBLISHED,
      }),
    ).toBe('copy-on-write');
  });

  it('copies an unpublished attachment on a controlled page', () => {
    expect(
      resolveUploadMode({
        controlled: true,
        locked: false,
        existing: UNPUBLISHED,
      }),
    ).toBe('copy-on-write');
  });

  it('copies a published attachment on a controlled page', () => {
    expect(
      resolveUploadMode({ controlled: true, locked: false, existing: PUBLISHED }),
    ).toBe('copy-on-write');
  });

  it('refuses to replace any attachment on a locked page', () => {
    expect(
      resolveUploadMode({ controlled: true, locked: true, existing: PUBLISHED }),
    ).toBe('refuse');
    expect(
      resolveUploadMode({
        controlled: true,
        locked: true,
        existing: UNPUBLISHED,
      }),
    ).toBe('refuse');
  });
});
