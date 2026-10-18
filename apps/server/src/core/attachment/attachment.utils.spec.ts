import { resolveUploadMode } from './attachment.utils';

const PUBLISHED = { publishedAt: new Date('2026-10-01T00:00:00Z') };
const UNPUBLISHED = { publishedAt: null };

describe('resolveUploadMode', () => {
  it('is new without an existing attachment', () => {
    expect(resolveUploadMode({ locked: false, existing: null })).toBe('new');
  });

  it('is new without an existing attachment on a locked page', () => {
    expect(resolveUploadMode({ locked: true, existing: null })).toBe('new');
  });

  it('replaces an unpublished attachment in place on an unlocked page', () => {
    expect(resolveUploadMode({ locked: false, existing: UNPUBLISHED })).toBe(
      'replace',
    );
  });

  it('copies a published attachment', () => {
    expect(resolveUploadMode({ locked: false, existing: PUBLISHED })).toBe(
      'copy-on-write',
    );
  });

  it('refuses to replace any attachment on a locked page', () => {
    expect(resolveUploadMode({ locked: true, existing: PUBLISHED })).toBe(
      'refuse',
    );
    expect(resolveUploadMode({ locked: true, existing: UNPUBLISHED })).toBe(
      'refuse',
    );
  });
});
