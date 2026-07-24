import { useCallback, useMemo } from "react";
import { atom, getDefaultStore, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";

export interface PageKeyEntry {
  dek: CryptoKey;
  lastActivity: number;
}

export const pageKeysAtom = atom<Record<string, PageKeyEntry>>({});

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
  pendingKeyRequests.add(pageId);
  vaultChannel.postMessage({
    type: "key-request",
    pageId,
  } satisfies VaultMessage);
  window.setTimeout(() => pendingKeyRequests.delete(pageId), 5000);
}

/** Lock the page in every other tab too (explicit lock / idle timeout). */
export function broadcastPageLock(pageId: string): void {
  vaultChannel?.postMessage({ type: "lock", pageId } satisfies VaultMessage);
}

export function usePageKey(pageId: string): CryptoKey | null {
  // Per-page selector: pageKeysAtom is replaced on every (throttled) activity
  // touch, but the dek's identity is stable while a page stays unlocked (see
  // storeKey), so subscribers only re-render on actual unlock/lock.
  const dekAtom = useMemo(
    () => selectAtom(pageKeysAtom, (keys) => keys[pageId]?.dek ?? null),
    [pageId],
  );
  return useAtomValue(dekAtom);
}

export function useUnlockPageKey(): (pageId: string, dek: CryptoKey) => void {
  return useCallback((pageId: string, dek: CryptoKey) => {
    // storeKey keeps an existing key's identity (see comment there)
    storeKey(pageId, dek);
    vaultChannel?.postMessage({
      type: "unlock",
      pageId,
      dek,
    } satisfies VaultMessage);
  }, []);
}

export function useLockPageKey(): (pageId: string) => void {
  const setPageKeys = useSetAtom(pageKeysAtom);

  return useCallback(
    (pageId: string) => {
      delete lastTouchedAt[pageId];
      setPageKeys((prev) => {
        if (!prev[pageId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[pageId];
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
      const now = Date.now();
      if (now - (lastTouchedAt[pageId] ?? 0) < TOUCH_THROTTLE_MS) {
        return;
      }
      lastTouchedAt[pageId] = now;

      setPageKeys((prev) => {
        if (!prev[pageId]) {
          return prev;
        }
        return {
          ...prev,
          [pageId]: { ...prev[pageId], lastActivity: now },
        };
      });
      // keep sibling tabs' auto-lock timers fresh while the user is active here
      vaultChannel?.postMessage({
        type: "touch",
        pageId,
      } satisfies VaultMessage);
    },
    [setPageKeys],
  );
}
