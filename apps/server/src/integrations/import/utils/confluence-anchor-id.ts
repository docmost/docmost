import { createHash } from 'crypto';

// Matches the alphabet used by generateNodeId() in
// packages/editor-ext/src/lib/utils.ts (customAlphabet from nanoid).
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const NODE_ID_LENGTH = 12;

/**
 * Returns a deterministic 12-character nodeId for a Confluence anchor.
 * The same (pageId, anchorName) pair always produces the same result, so
 * cross-page anchor links resolve to the anchor target without a
 * precomputed map. The output uses the same alphabet and length as
 * generateNodeId() from @docmost/editor-ext, so it is interchangeable
 * with editor-generated nodeIds.
 */
export function nodeIdFromConfluenceAnchor(
  pageId: string,
  anchorName: string,
): string {
  const digest = createHash('sha256')
    .update(`${pageId}#${anchorName}`)
    .digest();
  let out = '';
  for (let i = 0; i < NODE_ID_LENGTH; i++) {
    out += ALPHABET[digest[i] % ALPHABET.length];
  }
  return out;
}
