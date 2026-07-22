import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  pageKeysAtom,
  useLockPageKey,
  useTouchPageKey,
} from "@/features/encryption/hooks/page-key-store";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;

export function useAutoLock(
  pageId: string | null,
  opts?: { timeoutMs?: number; onLock?: () => void },
): void {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pageKeys = useAtomValue(pageKeysAtom);
  const lockPageKey = useLockPageKey();
  const touchPageKey = useTouchPageKey();

  const hasKey = pageId ? !!pageKeys[pageId] : false;
  const lastActivity = pageId ? pageKeys[pageId]?.lastActivity : undefined;

  const lastActivityRef = useRef(lastActivity);
  lastActivityRef.current = lastActivity;

  const onLockRef = useRef(opts?.onLock);
  onLockRef.current = opts?.onLock;

  useEffect(() => {
    if (!pageId || !hasKey) {
      return;
    }

    const touch = () => touchPageKey(pageId);
    // Returning to the tab counts as activity; hiding it must NOT extend
    // the idle timer (the countdown keeps running while the tab is hidden).
    const touchIfVisible = () => {
      if (document.visibilityState === "visible") {
        touch();
      }
    };
    const lock = () => {
      lockPageKey(pageId);
      onLockRef.current?.();
    };

    window.addEventListener("keydown", touch);
    window.addEventListener("pointerdown", touch);
    document.addEventListener("visibilitychange", touchIfVisible);
    window.addEventListener("beforeunload", lock);

    const interval = window.setInterval(() => {
      const last = lastActivityRef.current;
      if (last !== undefined && Date.now() - last > timeoutMs) {
        lock();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("keydown", touch);
      window.removeEventListener("pointerdown", touch);
      document.removeEventListener("visibilitychange", touchIfVisible);
      window.removeEventListener("beforeunload", lock);
      window.clearInterval(interval);
    };
  }, [pageId, hasKey, timeoutMs, touchPageKey, lockPageKey]);
}
