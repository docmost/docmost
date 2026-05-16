import { parseConfluenceEmojiId } from './confluence-emoji';

describe('parseConfluenceEmojiId', () => {
  it('parses a single code point id', () => {
    expect(parseConfluenceEmojiId('1f600')).toBe('😀');
    expect(parseConfluenceEmojiId('1F600')).toBe('😀');
  });

  it('parses a country flag (two regional indicator code points)', () => {
    expect(parseConfluenceEmojiId('1f1f3-1f1ec')).toBe('🇳🇬');
    expect(parseConfluenceEmojiId('1f1fa-1f1f8')).toBe('🇺🇸');
  });

  it('parses a ZWJ sequence (three code points)', () => {
    expect(parseConfluenceEmojiId('1f468-200d-1f4bb')).toBe('👨‍💻');
  });

  it('parses a five-component family ZWJ sequence', () => {
    // 👨‍👩‍👧‍👦 = man, ZWJ, woman, ZWJ, girl, ZWJ, boy
    expect(parseConfluenceEmojiId('1f468-200d-1f469-200d-1f467-200d-1f466')).toBe(
      '👨‍👩‍👧‍👦',
    );
  });

  it('returns null for missing input', () => {
    expect(parseConfluenceEmojiId(undefined)).toBeNull();
    expect(parseConfluenceEmojiId(null)).toBeNull();
    expect(parseConfluenceEmojiId('')).toBeNull();
  });

  it('returns null when any segment is not pure hex', () => {
    expect(parseConfluenceEmojiId('1f600-NG')).toBeNull();
    expect(parseConfluenceEmojiId('not-hex')).toBeNull();
    expect(parseConfluenceEmojiId('1f600--1f1ec')).toBeNull();
    expect(parseConfluenceEmojiId('1f600 1f1ec')).toBeNull();
  });

  it('returns null when a segment parses to a non-positive value', () => {
    expect(parseConfluenceEmojiId('0')).toBeNull();
  });

  it('returns null for code points outside the valid Unicode range', () => {
    // 0x110000 is one past the highest valid code point.
    expect(parseConfluenceEmojiId('110000')).toBeNull();
  });
});
