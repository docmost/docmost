import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  lockIdleSections,
  pageKeysAtom,
  touchAllSections,
} from "@/features/encryption/hooks/page-key-store";

// only "is anything unlocked at all" — subscribing to the vault itself would
// re-run the effect on every activity touch and restart the interval below
// before it ever had a chance to fire
const hasKeysAtom = selectAtom(
  pageKeysAtom,
  (keys) => Object.keys(keys).length > 0,
);

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;

/**
 * Locks idle encrypted sections, for the whole vault, from one place.
 *
 * Mounted once in the authenticated app shell rather than per editor: a key
 * stays in memory until it times out, so the countdown has to keep running
 * after the user navigates away from the encrypted page — a per-editor timer
 * would leave every key held for the rest of the session as soon as the user
 * opened anything else.
 *
 * Locking here is local to this tab. Keys are not shared between tabs, so a
 * tab that has been idle knows nothing about whether the user is active in
 * another one, and must not lock a section someone is still editing.
 */
export function useVaultAutoLock(opts?: { timeoutMs?: number }): void {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const hasKeys = useAtomValue(hasKeysAtom);

  useEffect(() => {
    if (!hasKeys) {
      return;
    }

    const touch = () => touchAllSections();
    // Returning to the tab counts as activity; hiding it must NOT extend
    // the idle timer (the countdown keeps running while the tab is hidden).
    const touchIfVisible = () => {
      if (document.visibilityState === "visible") {
        touch();
      }
    };

    // wheel and touchmove included so that reading a long page — scrolling
    // without ever clicking or typing — counts as being at the keyboard
    window.addEventListener("keydown", touch);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("wheel", touch, { passive: true });
    window.addEventListener("touchmove", touch, { passive: true });
    document.addEventListener("visibilitychange", touchIfVisible);

    const interval = window.setInterval(
      () => lockIdleSections(timeoutMs),
      CHECK_INTERVAL_MS,
    );

    return () => {
      window.removeEventListener("keydown", touch);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("wheel", touch);
      window.removeEventListener("touchmove", touch);
      document.removeEventListener("visibilitychange", touchIfVisible);
      window.clearInterval(interval);
    };
  }, [hasKeys, timeoutMs]);
}
