/**
 * Parse a Confluence emoji id (hex code points joined by hyphens) into a
 * Unicode string. Confluence emits ids in both single- and multi-code-point
 * forms:
 *
 *   "1f600"             → "😀"
 *   "1f1f3-1f1ec"       → "🇳🇬" (flag: Nigeria)
 *   "1f468-200d-1f4bb"  → "👨‍💻" (man technologist, ZWJ sequence)
 *
 * Returns null when the input is missing, empty, or doesn't parse cleanly as
 * hyphen-separated hex code points.
 */
export function parseConfluenceEmojiId(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null;
  const parts = raw.split('-');
  if (parts.length === 0) return null;
  if (!parts.every((p) => /^[0-9a-fA-F]+$/.test(p))) return null;
  const codePoints = parts.map((p) => parseInt(p, 16));
  if (codePoints.some((cp) => !Number.isFinite(cp) || cp <= 0)) return null;
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    // Out-of-range code points throw RangeError on String.fromCodePoint.
    return null;
  }
}
