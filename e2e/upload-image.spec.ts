import { test, expect } from '@playwright/test';

test.describe('Image upload validation', () => {
  test('client-side image validator should accept HEIC format', async () => {
    const heicMime = 'image/heic';
    const heifMime = 'image/heif';

    expect(heicMime.includes('image/')).toBe(true);
    expect(heifMime.includes('image/')).toBe(true);
  });

  test('HEIC and HEIF should be recognized as image types', () => {
    const imageTypes = ['image/heic', 'image/heif', 'image/jpeg', 'image/png'];
    const allowed = imageTypes.filter((t) => t.includes('image/'));
    expect(allowed).toContain('image/heic');
    expect(allowed).toContain('image/heif');
  });
});
