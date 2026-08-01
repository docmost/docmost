import { useCallback, useMemo } from "react";
import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";

export interface PageKeyEntry {
  dek: CryptoKey;
  lastActivity: number;
}

/**
 * Vault entries are keyed by *section* id — the id of the encryption root
 * holding the wrapped DEK — not by page id. An encrypted folder shares one
 * DEK across its whole subtree, so unlocking the root unlocks every page in
 * it with a single entry. A page that is its own root maps to itself, which
 * keeps single encrypted pages working unchanged.
 */
export const pageKeysAtom = atom<Record<string, PageKeyEntry>>({});

/** pageId → section id, learned from page and tree data as it loads */
export const pageSectionAtom = atom<Record<string, string>>({});

const sectionKeysAtom = atom((get) => ({
  keys: get(pageKeysAtom),
  sections: get(pageSectionAtom),
}));

/**
 * Resolving is idempotent: a section id maps to itself, so callers may pass
 * either a page id or a section id.
 */
function sectionIdFor(pageId: string): string {
  return getDefaultStore().get(pageSectionAtom)[pageId] ?? pageId;
}

export interface PageSectionEntry {
  pageId: string;
  encryptionRootId: string | null | undefined;
}

/**
 * The client-side mirror of the server's encryptionRootIdOf: which section's
 * key opens this page, read straight off page or tree data.
 */
export function sectionIdOf(page: {
  id: string;
  isEncrypted?: boolean;
  encryptionRootId?: string | null;
}): string | null {
  if (!page?.isEncrypted) return null;
  return page.encryptionRootId ?? page.id;
}

/**
 * Record which section a page belongs to. Called wherever page data arrives
 * (page queries, tree nodes, blob fetches) so the vault can resolve a page id
 * to the key that opens it.
 */
export function registerPageSection(
  pageId: string,
  encryptionRootId: string | null | undefined,
): void {
  registerPageSections([{ pageId, encryptionRootId }]);
}

/**
 * Bulk form of registerPageSection — one atom write for a whole tree load
 * instead of one per page (each write clones the whole index and notifies
 * every subscriber).
 */
export function registerPageSections(entries: PageSectionEntry[]): void {
  const store = getDefaultStore();
  const current = store.get(pageSectionAtom);

  // `undefined` means "this payload carries no encryption info" (an endpoint
  // that does not select the column) and must leave a known mapping alone —
  // only an explicit `null` clears it, meaning the page really is its own
  // root. Treating the two alike would let any such endpoint silently erase
  // the mapping and re-lock the page the user is reading.
  const relevant = entries.filter(
    ({ pageId, encryptionRootId }) => pageId && encryptionRootId !== undefined,
  );

  const changed = relevant.filter(({ pageId, encryptionRootId }) => {
    const wanted =
      !encryptionRootId || encryptionRootId === pageId
        ? undefined
        : encryptionRootId;
    return current[pageId] !== wanted;
  });

  if (changed.length === 0) return;

  store.set(pageSectionAtom, (prev) => {
    const next = { ...prev };
    for (const { pageId, encryptionRootId } of changed) {
      if (!encryptionRootId || encryptionRootId === pageId) {
        delete next[pageId];
      } else {
        next[pageId] = encryptionRootId;
      }
    }
    return next;
  });
}

const TOUCH_THROTTLE_MS = 5000;
const lastTouchedAt: Record<string, number> = {};

// ---------------------------------------------------------------------------
// Cross-tab locking.
//
// Key material never leaves the tab that derived it. A BroadcastChannel is
// same-origin but not same-*context*: anything running in the page — injected
// script, a compromised dependency, an extension with content-script access —
// can post to it and listen on it. A channel that carried DEKs would let such
// code ask sibling tabs to hand over every key they hold, or push a key of its
// own that the receiving tab would then encrypt the user's next save under.
//
// So the channel carries exactly one message, naming a section to forget.
// Locking is safe to accept from anywhere (the worst an attacker achieves is
// making the user retype a password), while unlocking always costs a password
// prompt in each tab.
// ---------------------------------------------------------------------------

type VaultMessage = { type: "lock"; pageId: string };

const vaultChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("docmost-e2ee-vault")
    : null;

function storeKey(pageId: string, dek: CryptoKey): void {
  lastTouchedAt[pageId] = Date.now();
  getDefaultStore().set(pageKeysAtom, (prev) => {
    // never replace an existing key: the material is identical, but a new
    // CryptoKey identity would remount the editor mid-edit
    if (prev[pageId]) {
      return {
        ...prev,
        [pageId]: { ...prev[pageId], lastActivity: Date.now() },
      };
    }
    return { ...prev, [pageId]: { dek, lastActivity: Date.now() } };
  });
}

function removeKey(pageId: string): void {
  delete lastTouchedAt[pageId];
  getDefaultStore().set(pageKeysAtom, (prev) => {
    if (!prev[pageId]) {
      return prev;
    }
    const next = { ...prev };
    delete next[pageId];
    return next;
  });
}

if (vaultChannel) {
  vaultChannel.onmessage = (event: MessageEvent<VaultMessage>) => {
    // anything may post here, so trust nothing about the shape
    if (event.data?.type === "lock" && typeof event.data.pageId === "string") {
      removeKey(event.data.pageId);
    }
  };
}

/**
 * Lock the section in every other tab too.
 *
 * Only an *explicit* lock broadcasts. An idle timeout is deliberately local:
 * each tab tracks its own activity, and a tab that has been idle long enough
 * to lock has no way to know whether the user is busy in another one.
 */
export function broadcastPageLock(pageId: string): void {
  vaultChannel?.postMessage({
    type: "lock",
    pageId: sectionIdFor(pageId),
  } satisfies VaultMessage);
}

/** the vault key id that opens this page (itself when it is its own root) */
export function usePageSectionId(pageId: string | null): string | null {
  const sectionAtom = useMemo(
    () =>
      selectAtom(pageSectionAtom, (sections) =>
        pageId ? (sections[pageId] ?? pageId) : null,
      ),
    [pageId],
  );
  return useAtomValue(sectionAtom);
}

export function usePageKey(pageId: string): CryptoKey | null {
  // Per-page selector: pageKeysAtom is replaced on every (throttled) activity
  // touch, but the dek's identity is stable while a page stays unlocked (see
  // storeKey), so subscribers only re-render on actual unlock/lock.
  const dekAtom = useMemo(
    () =>
      selectAtom(
        sectionKeysAtom,
        ({ keys, sections }) =>
          keys[sections[pageId] ?? pageId]?.dek ?? null,
      ),
    [pageId],
  );
  return useAtomValue(dekAtom);
}

export function useUnlockPageKey(): (pageId: string, dek: CryptoKey) => void {
  return useCallback((pageId: string, dek: CryptoKey) => {
    // stays in this tab: unlocking elsewhere requires the password there too
    // (see the cross-tab locking note above). storeKey keeps an existing key's
    // identity, so re-unlocking never remounts a live editor.
    storeKey(sectionIdFor(pageId), dek);
  }, []);
}

export function useLockPageKey(): (pageId: string) => void {
  const setPageKeys = useSetAtom(pageKeysAtom);

  return useCallback(
    (pageId: string) => {
      const sectionId = sectionIdFor(pageId);
      delete lastTouchedAt[sectionId];
      setPageKeys((prev) => {
        if (!prev[sectionId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
    },
    [setPageKeys],
  );
}

/**
 * Drop every section whose key has been idle for longer than `timeoutMs`,
 * in this tab only. Reads the vault at call time so a caller can poll on a
 * fixed interval without re-subscribing as activity updates the entries.
 */
export function lockIdleSections(timeoutMs: number): void {
  const now = Date.now();
  const entries = getDefaultStore().get(pageKeysAtom);
  for (const [sectionId, entry] of Object.entries(entries)) {
    if (now - entry.lastActivity > timeoutMs) {
      removeKey(sectionId);
    }
  }
}

/** Mark activity on every unlocked section (see useVaultAutoLock). */
export function touchAllSections(): void {
  const now = Date.now();
  const store = getDefaultStore();
  const sectionIds = Object.keys(store.get(pageKeysAtom)).filter(
    (sectionId) => now - (lastTouchedAt[sectionId] ?? 0) >= TOUCH_THROTTLE_MS,
  );
  if (sectionIds.length === 0) return;

  for (const sectionId of sectionIds) {
    lastTouchedAt[sectionId] = now;
  }
  store.set(pageKeysAtom, (prev) => {
    const next = { ...prev };
    for (const sectionId of sectionIds) {
      if (next[sectionId]) {
        next[sectionId] = { ...next[sectionId], lastActivity: now };
      }
    }
    return next;
  });
}

