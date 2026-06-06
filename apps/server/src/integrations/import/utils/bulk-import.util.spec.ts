import { buildBulkImportZip, sanitizeZipEntryPath } from './bulk-import.util';

// jszip is CJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require('jszip');

describe('sanitizeZipEntryPath', () => {
  it('strips path traversal and leading slashes', () => {
    expect(sanitizeZipEntryPath('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeZipEntryPath('/abs/path/page.md')).toBe('abs/path/page.md');
    expect(sanitizeZipEntryPath('a/./b/../c/page.md')).toBe('a/b/c/page.md');
  });

  it('normalizes backslashes and trims segments', () => {
    expect(sanitizeZipEntryPath('folder\\sub\\page.md')).toBe(
      'folder/sub/page.md',
    );
  });

  it('returns empty string for traversal-only names', () => {
    expect(sanitizeZipEntryPath('../..')).toBe('');
  });
});

describe('buildBulkImportZip', () => {
  it('packs files preserving folder structure and content', async () => {
    const buffer = await buildBulkImportZip([
      { filename: 'intro.md', buffer: Buffer.from('# Intro') },
      { filename: 'guide/setup.md', buffer: Buffer.from('# Setup') },
    ]);

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(
      expect.arrayContaining(['intro.md', 'guide/setup.md']),
    );
    expect(await zip.file('intro.md').async('string')).toBe('# Intro');
    expect(await zip.file('guide/setup.md').async('string')).toBe('# Setup');
  });

  it('de-duplicates colliding entry paths', async () => {
    const buffer = await buildBulkImportZip([
      { filename: 'page.md', buffer: Buffer.from('first') },
      { filename: 'page.md', buffer: Buffer.from('second') },
    ]);

    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files).sort();
    expect(names).toContain('page.md');
    expect(names).toContain('page-1.md');
    expect(await zip.file('page.md').async('string')).toBe('first');
    expect(await zip.file('page-1.md').async('string')).toBe('second');
  });

  it('sanitizes traversal filenames before packing', async () => {
    const buffer = await buildBulkImportZip([
      { filename: '../../evil.md', buffer: Buffer.from('x') },
    ]);
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toEqual(['evil.md']);
  });
});
