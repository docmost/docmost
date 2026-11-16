import { describe, expect, it } from "vitest";
import { formatUserLocalTime, getTimezoneCity } from "./user-time";

describe("formatUserLocalTime", () => {
  const now = new Date("2026-11-16T15:12:00Z");

  it("formats the time in the given zone", () => {
    const result = formatUserLocalTime("Africa/Lagos", now, "en-US");

    expect(result?.replace(/[  ]/g, " ")).toBe("4:12 PM");
  });

  it("returns null for an invalid zone", () => {
    expect(formatUserLocalTime("Mars/Olympus", now, "en-US")).toBeNull();
  });
});

describe("getTimezoneCity", () => {
  it("uses the last segment with spaces", () => {
    expect(getTimezoneCity("America/Argentina/Buenos_Aires")).toBe(
      "Buenos Aires",
    );
  });

  it("keeps a zone without a region", () => {
    expect(getTimezoneCity("UTC")).toBe("UTC");
  });
});
