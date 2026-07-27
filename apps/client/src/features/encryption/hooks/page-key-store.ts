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
// Cross-tab vault sync. The vault behaves as if shared between tabs of the
// same browser: unlocking a page anywhere unlocks it everywhere, an explicit
// or idle-timeout lock locks it everywhere, and activity in one tab keeps the
// auto-lock timer of every tab fresh. Closing a tab only drops that tab's
// in-memory copy of the key (no broadcast). CryptoKey objects are structured-
// cloneable, so the DEK itself can travel over the same-origin channel.
// ---------------------------------------------------------------------------

type VaultMessage =
  | { type: "key-request"; pageId: string }
  | { type: "key-response"; pageId: string; dek: CryptoKey }
  | { type: "unlock"; pageId: string; dek: CryptoKey }
  | { type: "lock"; pageId: string }
  | { type: "touch"; pageId: string };

const vaultChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("docmost-e2ee-vault")
    : null;

// pages this tab has asked sibling tabs for; key-response messages are only
// accepted while a request is pending (unlike "unlock" announcements)
const pendingKeyRequests = new Set<string>();

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
    const msg = event.data;
    switch (msg.type) {
      case "key-request": {
        const entry = getDefaultStore().get(pageKeysAtom)[msg.pageId];
        if (entry) {
          vaultChannel.postMessage({
            type: "key-response",
            pageId: msg.pageId,
            dek: entry.dek,
          } satisfies VaultMessage);
        }
        break;
      }
      case "key-response": {
        if (!pendingKeyRequests.has(msg.pageId)) {
          break;
        }
        pendingKeyRequests.delete(msg.pageId);
        storeKey(msg.pageId, msg.dek);
        break;
      }
      case "unlock": {
        storeKey(msg.pageId, msg.dek);
        break;
      }
      case "lock": {
        removeKey(msg.pageId);
        break;
      }
      case "touch": {
        lastTouchedAt[msg.pageId] = Date.now();
        getDefaultStore().set(pageKeysAtom, (prev) => {
          if (!prev[msg.pageId]) {
            return prev;
          }
          return {
            ...prev,
            [msg.pageId]: { ...prev[msg.pageId], lastActivity: Date.now() },
          };
        });
        break;
      }
    }
  };
}

/**
 * Ask sibling tabs for the DEK of a locked page. If another tab holds it,
 * the vault entry appears shortly after and usePageKey re-renders unlocked.
 */
export function requestPageKeyFromTabs(pageId: string): void {
  if (!vaultChannel) {
    return;
  }
  const sectionId = sectionIdFor(pageId);
  pendingKeyRequests.add(sectionId);
  vaultChannel.postMessage({
    type: "key-request",
    pageId: sectionId,
  } satisfies VaultMessage);
  window.setTimeout(() => pendingKeyRequests.delete(sectionId), 5000);
}

/** Lock the section in every other tab too (explicit lock / idle timeout). */
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
    const sectionId = sectionIdFor(pageId);
    // storeKey keeps an existing key's identity (see comment there)
    storeKey(sectionId, dek);
    vaultChannel?.postMessage({
      type: "unlock",
      pageId: sectionId,
      dek,
    } satisfies VaultMessage);
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

export function useTouchPageKey(): (pageId: string) => void {
  const setPageKeys = useSetAtom(pageKeysAtom);

  return useCallback(
    (pageId: string) => {
      const sectionId = sectionIdFor(pageId);
      const now = Date.now();
      if (now - (lastTouchedAt[sectionId] ?? 0) < TOUCH_THROTTLE_MS) {
        return;
      }
      lastTouchedAt[sectionId] = now;

      setPageKeys((prev) => {
        if (!prev[sectionId]) {
          return prev;
        }
        return {
          ...prev,
          [sectionId]: { ...prev[sectionId], lastActivity: now },
        };
      });
      // keep sibling tabs' auto-lock timers fresh while the user is active here
      vaultChannel?.postMessage({
        type: "touch",
        pageId: sectionId,
      } satisfies VaultMessage);
    },
    [setPageKeys],
  );
}
