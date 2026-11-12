import { addDays, startOfDay, todayIn } from "@docmost/base-formula/client";
import { getViewerTimeZone } from "@/ee/base/utils/viewer-zone";

export type ViewerClock = { timeZone: string; today: string };

const MAX_DELAY_MS = 3_600_000;

const listeners = new Set<() => void>();
let snapshot: ViewerClock | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function readClock(): ViewerClock {
  const timeZone = getViewerTimeZone();
  const today = todayIn(timeZone, new Date());
  if (snapshot && snapshot.timeZone === timeZone && snapshot.today === today) {
    return snapshot;
  }
  return { timeZone, today };
}

function arm() {
  if (timer !== null) clearTimeout(timer);
  const { timeZone, today } = snapshot ?? readClock();
  const untilMidnight =
    Date.parse(startOfDay(addDays(today, 1), timeZone)) - Date.now() + 1000;
  timer = setTimeout(check, Math.min(Math.max(untilMidnight, 0), MAX_DELAY_MS));
}

function check() {
  const next = readClock();
  if (next !== snapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  arm();
}

function onVisibilityChange() {
  check();
}

export function getViewerClock(): ViewerClock {
  if (listeners.size > 0 && snapshot) return snapshot;
  snapshot = readClock();
  return snapshot;
}

export function subscribeViewerClock(listener: () => void): () => void {
  if (listeners.size === 0) {
    snapshot = readClock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", check);
    arm();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", check);
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }
  };
}
