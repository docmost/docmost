import { describe, expect, it } from "vitest";
import { timeZoneName } from "./time-zones";

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
