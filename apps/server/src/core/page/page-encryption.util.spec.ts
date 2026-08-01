import {
  encryptionRootIdOf,
  isStaleSnapshot,
  staleSnapshotPageId,
  staleVersionPageId,
} from './page-encryption.util';

/**
 * "Which key opens this page" is resolved here rather than read off the column,
 * because a root and a plaintext page both have a null encryption_root_id.
 * Every access check and every blob binding depends on this distinction, so
 * each case is pinned.
 */
describe('encryptionRootIdOf', () => {
  it('returns nothing for a plaintext page', () => {
    expect(encryptionRootIdOf({ id: 'page-1', isEncrypted: false })).toBeNull();
  });

  it('ignores a stale root pointer on a page that is not encrypted', () => {
    // the column is cleared on decryption, but a caller must never be handed a
    // section id for a page whose content is plaintext
    expect(
      encryptionRootIdOf({
        id: 'page-1',
        isEncrypted: false,
        encryptionRootId: 'root-1',
      }),
    ).toBeNull();
  });

  it('maps a self-rooted encrypted page to itself', () => {
    expect(encryptionRootIdOf({ id: 'page-1', isEncrypted: true })).toBe(
      'page-1',
    );
    expect(
      encryptionRootIdOf({
        id: 'page-1',
        isEncrypted: true,
        encryptionRootId: null,
      }),
    ).toBe('page-1');
  });

  it('maps a keyed page to the root holding the key', () => {
    expect(
      encryptionRootIdOf({
        id: 'page-2',
        isEncrypted: true,
        encryptionRootId: 'root-1',
      }),
    ).toBe('root-1');
  });
});

/**
 * Guards the conversion's overwrite: the blobs encode a manifest snapshot,
 * and writing them over a row edited since would silently destroy the edit
 * while the conversion purges the history that could have recovered it.
 */
describe('isStaleSnapshot', () => {
  const at = '2026-07-30T12:00:00.000Z';

  it('accepts a row unchanged since the manifest', () => {
    expect(isStaleSnapshot(new Date(at), new Date(at).getTime())).toBe(false);
    // string form, as a driver without date parsing would return it
    expect(isStaleSnapshot(at, new Date(at).getTime())).toBe(false);
  });

  it('rejects a row edited after the manifest', () => {
    const later = new Date(new Date(at).getTime() + 1);
    expect(isStaleSnapshot(later, new Date(at).getTime())).toBe(true);
  });

  it('rejects a snapshot claiming to be newer than the row', () => {
    // cannot happen through the real flow, but drift in either direction
    // means the ciphertext does not encode what the row holds
    const earlier = new Date(new Date(at).getTime() - 1);
    expect(isStaleSnapshot(earlier, new Date(at).getTime())).toBe(true);
  });

  it('fails closed on an unparseable snapshot timestamp', () => {
    expect(isStaleSnapshot(new Date(at), NaN)).toBe(true);
    expect(isStaleSnapshot(new Date(at), undefined)).toBe(true);
  });
});

/**
 * The whole-section sweep the encrypt conversion runs over its locked rows.
 * A regression that checked only the root, or dropped a descendant from the
 * comparison, would let the conversion overwrite a page edited after the
 * manifest — these pin that every converted page takes part.
 */
describe('staleSnapshotPageId', () => {
  const t0 = new Date('2026-07-30T12:00:00.000Z');
  const t1 = new Date(t0.getTime() + 1000);
  const snapshots = new Map([
    ['root', t0.getTime()],
    ['child', t0.getTime()],
  ]);

  it('passes a section unchanged since the manifest', () => {
    expect(
      staleSnapshotPageId(
        [
          { id: 'root', updatedAt: t0 },
          { id: 'child', updatedAt: t0 },
        ],
        snapshots,
      ),
    ).toBeNull();
  });

  it('flags a drifted descendant even when the root still matches', () => {
    expect(
      staleSnapshotPageId(
        [
          { id: 'root', updatedAt: t0 },
          { id: 'child', updatedAt: t1 },
        ],
        snapshots,
      ),
    ).toBe('child');
  });

  it('ignores extra locked rows that carry no snapshot (the join target)', () => {
    // a join locks the target section's root and destination alongside the
    // subtree; they are not overwritten, so their timestamps must not veto
    expect(
      staleSnapshotPageId(
        [
          { id: 'root', updatedAt: t0 },
          { id: 'child', updatedAt: t0 },
          { id: 'join-root', updatedAt: t1 },
          { id: 'join-destination', updatedAt: t1 },
        ],
        snapshots,
      ),
    ).toBeNull();
  });
});

/** the decrypt-side equivalent, keyed on the encrypted save counter */
describe('staleVersionPageId', () => {
  const versions = new Map([
    ['root', 3],
    ['child', 1],
  ]);

  it('passes a section whose versions all match the manifest', () => {
    expect(
      staleVersionPageId(
        [
          { id: 'root', encryptedVersion: '3' },
          { id: 'child', encryptedVersion: 1 },
        ],
        versions,
      ),
    ).toBeNull();
  });

  it('flags a descendant saved after the manifest', () => {
    expect(
      staleVersionPageId(
        [
          { id: 'root', encryptedVersion: '3' },
          { id: 'child', encryptedVersion: '2' },
        ],
        versions,
      ),
    ).toBe('child');
  });

  it('fails closed on a locked row with no expected version', () => {
    // decryption locks nothing beyond the section, so an unexpected row is
    // drift, not a join target to skip
    expect(
      staleVersionPageId([{ id: 'stray', encryptedVersion: 0 }], versions),
    ).toBe('stray');
  });
});
