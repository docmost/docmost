import { timeAgo } from "@/lib/time.ts";
import { useMemo, useSyncExternalStore } from "react";

let tick = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (listeners.size === 1) {
    intervalId = setInterval(() => {
      tick++;
      listeners.forEach((cb) => cb());
    }, 60_000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return tick;
}

export function useTimeAgo(date: Date | string) {
  const currentTick = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => timeAgo(new Date(date)), [date, currentTick]);
}
