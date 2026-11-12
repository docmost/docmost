import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zone = vi.hoisted(() => ({ current: "America/New_York", reads: 0, midnight: null as string | null }));
vi.mock("@/ee/base/utils/viewer-zone", () => ({
  getViewerTimeZone: () => {
    zone.reads += 1;
    return zone.current;
  },
}));
vi.mock("@docmost/base-formula/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@docmost/base-formula/client")>();
  return {
    ...actual,
    startOfDay: (ymd: string, timeZone: string) => zone.midnight ?? actual.startOfDay(ymd, timeZone),
  };
});

import { getViewerClock, subscribeViewerClock } from "./viewer-clock";

let stop = () => {};
const start = (now: string, timeZone: string) => {
  zone.current = timeZone;
  vi.setSystemTime(new Date(now));
  const listener = vi.fn();
  stop = subscribeViewerClock(listener);
  return listener;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  zone.midnight = null;
  stop();
  stop = () => {};
  vi.useRealTimers();
});

describe("viewer clock", () => {
  it.each([
    ["2026-11-12T04:59:59.000Z", "America/New_York", "2026-11-11"],
    ["2026-11-12T05:00:00.000Z", "America/New_York", "2026-11-12"],
    ["2026-11-11T22:59:59.000Z", "Europe/Berlin", "2026-11-11"],
    ["2026-11-11T23:00:00.000Z", "Europe/Berlin", "2026-11-12"],
    ["2026-11-12T10:00:00.000Z", "Pacific/Kiritimati", "2026-11-13"],
    ["2026-11-12T09:59:59.000Z", "Pacific/Honolulu", "2026-11-11"],
    ["2026-11-11T18:30:00.000Z", "+05:30", "2026-11-12"],
  ])("at %s in %s today is %s", (now, timeZone, today) => {
    start(now, timeZone);
    expect(getViewerClock()).toEqual({ timeZone, today });
  });

  it.each([
    ["a 23 hour day west of UTC", "2026-03-09T03:59:30.000Z", "America/New_York", "2026-03-08", "2026-03-09"],
    ["a 25 hour day west of UTC", "2026-11-02T04:59:30.000Z", "America/New_York", "2026-11-01", "2026-11-02"],
    ["a 23 hour day east of UTC", "2026-03-29T21:59:30.000Z", "Europe/Berlin", "2026-03-29", "2026-03-30"],
    ["a 25 hour day east of UTC", "2026-10-25T22:59:30.000Z", "Europe/Berlin", "2026-10-25", "2026-10-26"],
  ])("tells its listeners when %s ends", (_name, now, timeZone, before, after) => {
    const listener = start(now, timeZone);
    expect(getViewerClock().today).toBe(before);
    vi.advanceTimersByTime(29_000);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3_000);
    expect(getViewerClock().today).toBe(after);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("catches up when the tab wakes after the day changed", () => {
    const listener = start("2026-11-12T04:00:00.000Z", "America/New_York");
    expect(getViewerClock().today).toBe("2026-11-11");
    vi.setSystemTime(new Date("2026-11-12T13:00:00.000Z"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getViewerClock().today).toBe("2026-11-12");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("follows a change of the browser zone on focus", () => {
    const listener = start("2026-11-12T10:00:00.000Z", "Pacific/Honolulu");
    zone.current = "Pacific/Kiritimati";
    window.dispatchEvent(new Event("focus"));
    expect(getViewerClock()).toEqual({ timeZone: "Pacific/Kiritimati", today: "2026-11-13" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps one snapshot object until something changes", () => {
    const listener = start("2026-11-12T10:00:00.000Z", "Europe/Berlin");
    const first = getViewerClock();
    window.dispatchEvent(new Event("focus"));
    expect(getViewerClock()).toBe(first);
    expect(listener).not.toHaveBeenCalled();
  });

  it("reads the clock afresh while nobody listens", () => {
    zone.current = "Europe/Berlin";
    vi.setSystemTime(new Date("2026-11-12T10:00:00.000Z"));
    const first = getViewerClock();
    expect(getViewerClock()).toBe(first);
    vi.setSystemTime(new Date("2026-11-14T10:00:00.000Z"));
    expect(getViewerClock()).toEqual({ timeZone: "Europe/Berlin", today: "2026-11-14" });
  });

  it("waits at least a second when the next midnight is already past", () => {
    zone.midnight = "2026-11-12T09:00:00.000Z";
    start("2026-11-12T10:00:00.000Z", "Europe/Berlin");
    const reads = zone.reads;
    vi.advanceTimersByTime(999);
    expect(zone.reads).toBe(reads);
    vi.advanceTimersByTime(1);
    expect(zone.reads).toBe(reads + 1);
  });
});
