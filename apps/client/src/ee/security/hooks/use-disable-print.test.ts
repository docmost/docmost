import { renderHook } from "@testing-library/react";
import { createElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifications } from "@mantine/notifications";
import { useDisablePrint, usePrintBlockReason } from "./use-disable-print";

const platform = vi.hoisted(() => ({ apple: false }));

vi.mock("@/lib/utils.tsx", () => ({
  platformModifierKey: (event: KeyboardEvent) =>
    platform.apple ? event.metaKey : event.ctrlKey,
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

function at(path: string) {
  return ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [path] }, children);
}

const onPage = { wrapper: at("/s/general/p/page-1") };

function pressKey(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  platform.apple = false;
  vi.mocked(notifications.show).mockClear();
});

afterEach(() => {
  delete document.body.dataset.exportDisabled;
});

describe("useDisablePrint", () => {
  it("marks the body with the reason while mounted", () => {
    const { unmount } = renderHook(() => useDisablePrint("Blocked"), onPage);

    expect(document.body.dataset.exportDisabled).toBe("Blocked");

    unmount();
    expect(document.body.dataset.exportDisabled).toBeUndefined();
  });

  it("keeps the block while another caller still holds it", () => {
    const first = renderHook(() => useDisablePrint("Host"), onPage);
    const second = renderHook(() => useDisablePrint("Embed"), onPage);

    first.unmount();
    expect(document.body.dataset.exportDisabled).toBe("Embed");
    expect(pressKey({ key: "p", code: "KeyP", ctrlKey: true }).defaultPrevented).toBe(true);

    second.unmount();
    expect(document.body.dataset.exportDisabled).toBeUndefined();
    expect(pressKey({ key: "p", code: "KeyP", ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it("blocks Cmd+P but not Ctrl+P on Apple devices", () => {
    platform.apple = true;
    renderHook(() => useDisablePrint("Blocked"), onPage);

    expect(pressKey({ key: "p", code: "KeyP", metaKey: true }).defaultPrevented).toBe(true);
    expect(pressKey({ key: "p", code: "KeyP", ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it("matches the physical P key only on layouts without Latin letters", () => {
    renderHook(() => useDisablePrint("Blocked"), onPage);

    expect(pressKey({ key: "з", code: "KeyP", ctrlKey: true }).defaultPrevented).toBe(true);
    // Dvorak types "l" on the QWERTY P key
    expect(pressKey({ key: "l", code: "KeyP", ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it("leaves shortcuts with Shift or Alt alone", () => {
    renderHook(() => useDisablePrint("Blocked"), onPage);

    expect(
      pressKey({ key: "P", code: "KeyP", ctrlKey: true, shiftKey: true }).defaultPrevented,
    ).toBe(false);
    expect(
      pressKey({ key: "p", code: "KeyP", ctrlKey: true, altKey: true }).defaultPrevented,
    ).toBe(false);
  });

  it("ignores keydown events that carry no key", () => {
    renderHook(() => useDisablePrint("Blocked"), onPage);

    expect(() => document.dispatchEvent(new Event("keydown"))).not.toThrow();
  });

  it("shows the reason once per press and skips key repeats", () => {
    renderHook(() => useDisablePrint("Blocked"), onPage);

    pressKey({ key: "p", code: "KeyP", ctrlKey: true });
    pressKey({ key: "p", code: "KeyP", ctrlKey: true, repeat: true });

    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Blocked" }),
    );
  });

  it("does nothing without a reason", () => {
    renderHook(() => useDisablePrint(null), onPage);

    expect(document.body.dataset.exportDisabled).toBeUndefined();
    expect(pressKey({ key: "p", code: "KeyP", ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it("leaves public share and docs pages printable", () => {
    renderHook(() => useDisablePrint("Blocked"), { wrapper: at("/share/abc/p/page-1") });
    renderHook(() => useDisablePrint("Blocked"), { wrapper: at("/docs/space/page-1") });

    expect(document.body.dataset.exportDisabled).toBeUndefined();
  });

  it("reports the active reason to subscribers", () => {
    const reason = renderHook(() => usePrintBlockReason(), onPage);
    expect(reason.result.current).toBeNull();

    const block = renderHook(() => useDisablePrint("Blocked"), onPage);
    expect(reason.result.current).toBe("Blocked");

    block.unmount();
    expect(reason.result.current).toBeNull();
  });
});
