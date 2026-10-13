import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimChunkReload, isChunkLoadFailure } from "./chunk-load-recovery";

describe("claimChunkReload", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("allows the first reload", () => {
    expect(claimChunkReload()).toBe(true);
  });

  it("refuses a second reload inside the cooldown", () => {
    claimChunkReload();
    vi.advanceTimersByTime(5_000);
    expect(claimChunkReload()).toBe(false);
  });

  it("allows another reload once the cooldown has passed", () => {
    claimChunkReload();
    vi.advanceTimersByTime(60_000);
    expect(claimChunkReload()).toBe(true);
  });

  it("refuses to reload while offline without using up the cooldown", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(claimChunkReload()).toBe(false);
    onLine.mockReturnValue(true);
    expect(claimChunkReload()).toBe(true);
  });

  it("refuses to reload when session storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(claimChunkReload()).toBe(false);
  });
});

describe("isChunkLoadFailure", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://app.docmost.com/assets/groups-DHo4N9RM.js",
    "error loading dynamically imported module: https://app.docmost.com/assets/groups-DHo4N9RM.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/groups-BJHsxMuK.css",
  ])("treats %s as a load failure", (message) => {
    expect(isChunkLoadFailure(new TypeError(message))).toBe(true);
  });

  it("does not treat an error thrown while a module runs as a load failure", () => {
    expect(
      isChunkLoadFailure(
        new ReferenceError("Cannot access 'Groups' before initialization"),
      ),
    ).toBe(false);
  });

  it("does not treat a missing payload as a load failure", () => {
    expect(isChunkLoadFailure(undefined)).toBe(false);
  });
});
