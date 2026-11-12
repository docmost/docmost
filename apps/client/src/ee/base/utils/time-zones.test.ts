import { afterEach, describe, expect, it, vi } from "vitest";
import { listTimeZones, timeZoneName } from "./time-zones";

describe("timeZoneName", () => {
  it.each([
    ["America/New_York", "America/New York"],
    ["America/Argentina/Buenos_Aires", "America/Argentina/Buenos Aires"],
    ["UTC", "UTC"],
    ["+05:30", "+05:30"],
  ])("shows %s as %s", (zone, name) => {
    expect(timeZoneName(zone)).toBe(name);
  });
});

describe("listTimeZones", () => {
  const supported = () =>
    vi.spyOn(Intl as unknown as { supportedValuesOf: (key: string) => string[] }, "supportedValuesOf");
  afterEach(() => vi.restoreAllMocks());

  it("puts UTC first, then what the runtime lists", () => {
    supported().mockReturnValue(["America/New_York", "Europe/Berlin", "UTC"]);
    expect(listTimeZones("Europe/Berlin")).toEqual(["UTC", "America/New_York", "Europe/Berlin"]);
    expect(listTimeZones(null)).toEqual(["UTC", "America/New_York", "Europe/Berlin"]);
  });

  it.each(["Asia/Kolkata", "+05:30"])(
    "adds the stored zone %s when the runtime lists it under another name or not at all",
    (stored) => {
      supported().mockReturnValue(["Asia/Calcutta", "Europe/Berlin"]);
      expect(listTimeZones(stored)).toEqual(["UTC", "Asia/Calcutta", "Europe/Berlin", stored]);
    },
  );

  it("still offers UTC and the stored zone when the runtime cannot list zones", () => {
    supported().mockImplementation(() => {
      throw new RangeError("unsupported");
    });
    expect(listTimeZones("Europe/Berlin")).toEqual(["UTC", "Europe/Berlin"]);
  });
});
