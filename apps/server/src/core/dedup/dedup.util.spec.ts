import { contentHash, normalizeText } from './dedup.util';

describe('dedup.util', () => {
  describe('normalizeText', () => {
    it('collapses whitespace, trims, and lowercases', () => {
      expect(normalizeText('  Hello   World\n\t ')).toBe('hello world');
    });

    it('returns empty string for null/undefined/empty', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
      expect(normalizeText('')).toBe('');
    });
  });

  describe('contentHash', () => {
    it('is a 64-char hex sha256', () => {
      const h = contentHash('some content');
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      expect(contentHash('abc')).toBe(contentHash('abc'));
    });

    it('treats whitespace/case-only differences as identical', () => {
      expect(contentHash('Hello   World')).toBe(contentHash('hello world'));
      expect(contentHash('  hello world  ')).toBe(contentHash('hello world'));
    });

    it('differs for genuinely different content', () => {
      expect(contentHash('hello world')).not.toBe(contentHash('goodbye world'));
    });
  });
});
