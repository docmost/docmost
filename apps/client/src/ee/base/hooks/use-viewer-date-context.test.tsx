import { DatesProvider } from "@mantine/dates";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zone = vi.hoisted(() => ({ current: "America/New_York" }));
vi.mock("@/ee/base/utils/viewer-zone", () => ({
  getViewerTimeZone: () => zone.current,
}));

import { useViewerDateContext } from "./use-viewer-date-context";

const weekStartsOn =
  (firstDayOfWeek: 0 | 1) =>
  ({ children }: { children: ReactNode }) => (
    <DatesProvider settings={{ firstDayOfWeek }}>{children}</DatesProvider>
  );

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useViewerDateContext", () => {
  it("gives the zone, the viewer's day and the week start the pickers draw with", () => {
    zone.current = "America/New_York";
    vi.setSystemTime(new Date("2026-11-12T03:30:00.000Z"));
    const { result } = renderHook(() => useViewerDateContext(), { wrapper: weekStartsOn(0) });
    expect(result.current).toEqual({ timeZone: "America/New_York", weekStart: 0, today: "2026-11-11" });
  });

  it("keeps its object between renders and re-renders when the day ends", () => {
    zone.current = "Europe/Berlin";
    vi.setSystemTime(new Date("2026-11-11T22:59:30.000Z"));
    const { result, rerender } = renderHook(() => useViewerDateContext(), { wrapper: weekStartsOn(1) });
    const first = result.current;
    expect(first).toEqual({ timeZone: "Europe/Berlin", weekStart: 1, today: "2026-11-11" });
    rerender();
    expect(result.current).toBe(first);
    act(() => vi.advanceTimersByTime(32_000));
    expect(result.current.today).toBe("2026-11-12");
  });
});
