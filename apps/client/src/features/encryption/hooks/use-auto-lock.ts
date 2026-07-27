import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  broadcastPageLock,
  pageKeysAtom,
  useLockPageKey,
  usePageSectionId,
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

  // the timer belongs to the section, not the page: every page in an
  // encrypted section shares one key and one idle countdown
  const sectionId = usePageSectionId(pageId);

  const hasKey = sectionId ? !!pageKeys[sectionId] : false;
  const lastActivity = sectionId
    ? pageKeys[sectionId]?.lastActivity
    : undefined;

  const lastActivityRef = useRef(lastActivity);
  lastActivityRef.current = lastActivity;

  const onLockRef = useRef(opts?.onLock);
  onLockRef.current = opts?.onLock;

  useEffect(() => {
    if (!sectionId || !hasKey) {
      return;
    }

    const touch = () => touchPageKey(sectionId);
    // Returning to the tab counts as activity; hiding it must NOT extend
    // the idle timer (the countdown keeps running while the tab is hidden).
    const touchIfVisible = () => {
      if (document.visibilityState === "visible") {
        touch();
      }
    };
    const lock = () => {
      lockPageKey(sectionId);
      onLockRef.current?.();
    };
    // Idle timeout locks the page in every tab (cross-tab activity keeps the
    // timers fresh, so a genuine timeout means the user is idle everywhere).
    // Closing a tab only drops that tab's in-memory key: it must NOT lock
    // sibling tabs that are still in use.
    const lockEverywhere = () => {
      broadcastPageLock(sectionId);
      lock();
    };

    window.addEventListener("keydown", touch);
    window.addEventListener("pointerdown", touch);
    document.addEventListener("visibilitychange", touchIfVisible);
    window.addEventListener("beforeunload", lock);

    const interval = window.setInterval(() => {
      const last = lastActivityRef.current;
      if (last !== undefined && Date.now() - last > timeoutMs) {
        lockEverywhere();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener("keydown", touch);
      window.removeEventListener("pointerdown", touch);
      document.removeEventListener("visibilitychange", touchIfVisible);
      window.removeEventListener("beforeunload", lock);
      window.clearInterval(interval);
    };
  }, [sectionId, hasKey, timeoutMs, touchPageKey, lockPageKey]);
}
