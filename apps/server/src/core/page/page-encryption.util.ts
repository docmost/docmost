/**
 * Ceiling on how many pages one conversion may touch. The whole subtree is
 * converted in a single transaction, so this bounds both the lock footprint
 * and the amount of ciphertext a single request can carry.
 */
export const MAX_ENCRYPTED_TREE_PAGES = 200;

/**
 * An encrypted subtree shares one DEK. The root page stores the wrapped key
 * (encryption_meta); every other page in the section points at it through
 * encryption_root_id. Plain pages and encryption roots both have a null
 * encryption_root_id, so "which key opens this page" is resolved here rather
 * than read off the column directly.
 */
export function encryptionRootIdOf(page: {
  id: string;
  isEncrypted: boolean;
  encryptionRootId?: string | null;
}): string | null {
  if (!page.isEncrypted) return null;
  return page.encryptionRootId ?? page.id;
}

/**
 * Whether a page changed between the manifest snapshot the client encrypted
 * and the conversion transaction. The blobs were produced from the snapshot,
 * so writing them over a newer row would silently destroy the newer edits —
 * and the conversion purges the history that could have recovered them.
 *
 * Fails closed: an unparseable snapshot timestamp reads as stale rather than
 * as a match.
 */
export function isStaleSnapshot(
  rowUpdatedAt: Date | string,
  snapshotMs: number | undefined,
): boolean {
  if (!Number.isFinite(snapshotMs)) return true;
  return new Date(rowUpdatedAt).getTime() !== snapshotMs;
}

/**
 * The encrypt-conversion freshness check, over every row the conversion
 * transaction locked: returns the id of the first page edited since the
 * manifest snapshot the ciphertext was produced from, or null when the whole
 * section is unchanged. Rows without a snapshot entry are the extra lock ids
 * a join takes (the target section's root and destination) — they are not
 * being overwritten, so they carry no snapshot to compare.
 */
export function staleSnapshotPageId(
  rows: Array<{ id: string; updatedAt: Date | string }>,
  snapshotMsByPageId: Map<string, number>,
): string | null {
  for (const row of rows) {
    if (!snapshotMsByPageId.has(row.id)) continue;
    if (isStaleSnapshot(row.updatedAt, snapshotMsByPageId.get(row.id))) {
      return row.id;
    }
  }
  return null;
}

/**
 * The decrypt-conversion freshness check: returns the id of the first page
 * whose encrypted save counter moved past the manifest version the plaintext
 * was decrypted from, or null when every page matches. Fails closed — a row
 * with no expected version reads as stale, since decryption locks nothing
 * beyond the section itself.
 */
export function staleVersionPageId(
  rows: Array<{ id: string; encryptedVersion: string | number | bigint }>,
  baseVersionByPageId: Map<string, number>,
): string | null {
  for (const row of rows) {
    if (Number(row.encryptedVersion) !== baseVersionByPageId.get(row.id)) {
      return row.id;
    }
  }
  return null;
}
