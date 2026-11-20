import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewerTimeZone, isSameTimeZone } from "./viewer-zone";

const report = (timeZone: unknown) =>
  vi
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions);

afterEach(() => vi.restoreAllMocks());

describe("getViewerTimeZone", () => {
  it.each(["America/New_York", "Europe/Berlin", "+05:30", "UTC"])(
    "returns %s as the runtime reports it",
    (zone) => {
      report(zone);
      expect(getViewerTimeZone()).toBe(zone);
    },
  );

  it.each([undefined, "", "Not/AZone"])(
    "falls back to UTC when the runtime reports %p",
    (zone) => {
      report(zone);
      expect(getViewerTimeZone()).toBe("UTC");
    },
  );
});

describe("isSameTimeZone", () => {
  const now = new Date("2026-11-12T10:00:00.000Z");

  it.each([
    ["Europe/Berlin", "Europe/Berlin"],
    ["Asia/Kolkata", "Asia/Calcutta"],
    ["Europe/Kyiv", "Europe/Kiev"],
    ["UTC", "+00:00"],
  ])("treats %s and %s as one zone", (a, b) => {
    expect(isSameTimeZone(a, b, now)).toBe(true);
  });

  it.each([
    ["America/New_York", "Europe/Berlin"],
    ["Europe/London", "UTC"],
    ["Europe/Berlin", "Not/AZone"],
  ])("tells %s and %s apart", (a, b) => {
    expect(isSameTimeZone(a, b, now)).toBe(false);
  });
});
