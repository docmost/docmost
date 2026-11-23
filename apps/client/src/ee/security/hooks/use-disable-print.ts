import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { platformModifierKey } from "@/lib/utils.tsx";
import "@/ee/security/styles/disable-print.css";

// several views on one screen can block printing, e.g. a page and the bases embedded in it
const activeReasons = new Map<symbol, string>();
const listeners = new Set<() => void>();

function currentReason(): string | null {
  return activeReasons.values().next().value ?? null;
}

function isPrintShortcut(event: KeyboardEvent): boolean {
  if (event.shiftKey || event.altKey || !platformModifierKey(event)) {
    return false;
  }
  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
  // layouts without Latin letters report another character; use the physical key there
  return /^[a-z]$/.test(key) ? key === "p" : event.code === "KeyP";
}

function blockPrintShortcut(event: KeyboardEvent) {
  if (!isPrintShortcut(event)) return;
  event.preventDefault();
  if (event.repeat) return;
  notifications.show({
    id: "print-disabled",
    message: currentReason(),
    color: "red",
  });
}

function syncPrintBlock() {
  const reason = currentReason();
  if (reason) {
    document.body.dataset.exportDisabled = reason;
    document.addEventListener("keydown", blockPrintShortcut);
  } else {
    delete document.body.dataset.exportDisabled;
    document.removeEventListener("keydown", blockPrintShortcut);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDisablePrint(reason: string | null) {
  const { pathname } = useLocation();
  // public share and docs pages stay printable, like the rest of public content
  const isPublicView =
    pathname.startsWith("/share/") || pathname.startsWith("/docs/");
  const activeReason = isPublicView ? null : reason;

  useEffect(() => {
    if (!activeReason) return;
    const key = Symbol();
    activeReasons.set(key, activeReason);
    syncPrintBlock();
    return () => {
      activeReasons.delete(key);
      syncPrintBlock();
    };
  }, [activeReason]);
}

export function usePrintBlockReason(): string | null {
  return useSyncExternalStore(subscribe, currentReason);
}
