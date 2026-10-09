import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimChunkReload } from "./chunk-load-recovery";

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
    vi.advanceTimersByTime(10_000);
    expect(claimChunkReload()).toBe(true);
  });

  it("refuses to reload when session storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(claimChunkReload()).toBe(false);
  });
});
