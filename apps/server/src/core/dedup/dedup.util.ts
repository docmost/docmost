import { createHash } from 'crypto';

/**
 * Normalizes page text before hashing so trivially-different copies (extra
 * whitespace, casing, leading/trailing blanks) hash equal. Deterministic.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** sha256 hex of the normalized text. */
export function contentHash(text: string | null | undefined): string {
  return createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}
