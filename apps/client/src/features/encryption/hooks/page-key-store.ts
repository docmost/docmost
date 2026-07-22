import { useCallback } from "react";
import { atom, useAtomValue, useSetAtom } from "jotai";

export interface PageKeyEntry {
  dek: CryptoKey;
  lastActivity: number;
}

export const pageKeysAtom = atom<Record<string, PageKeyEntry>>({});

const TOUCH_THROTTLE_MS = 5000;
const lastTouchedAt: Record<string, number> = {};

export function usePageKey(pageId: string): CryptoKey | null {
  const pageKeys = useAtomValue(pageKeysAtom);
  return pageKeys[pageId]?.dek ?? null;
}

export function useUnlockPageKey(): (pageId: string, dek: CryptoKey) => void {
  const setPageKeys = useSetAtom(pageKeysAtom);

  return useCallback(
    (pageId: string, dek: CryptoKey) => {
      lastTouchedAt[pageId] = Date.now();
      setPageKeys((prev) => ({
        ...prev,
        [pageId]: { dek, lastActivity: Date.now() },
      }));
    },
    [setPageKeys],
  );
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
    },
    [setPageKeys],
  );
}
