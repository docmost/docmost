import { describe, expect, it } from "vitest";
import { formDateKind, fromDateTimeInput, toDateTimeInput } from "./form-date";

const NY = "America/New_York";
const BERLIN = "Europe/Berlin";

describe("formDateKind", () => {
  it("is the property's kind, as the question carries it", () => {
    expect(formDateKind({ includeTime: true })).toBe("datetime");
    expect(formDateKind({ includeTime: false })).toBe("date");
    expect(formDateKind({})).toBe("date");
  });
});

describe("toDateTimeInput", () => {
  it.each([
    [{ start: "2026-11-12T15:00:00.000Z" }, NY, "2026-11-12 10:00:00"],
    [{ start: "2026-11-12T15:00:00.000Z" }, BERLIN, "2026-11-12 16:00:00"],
    [{ start: "2026-11-01T06:30:00.000Z" }, NY, "2026-11-01 01:30:00"],
    [null, NY, null],
    [{ start: "9999-12-31T23:59:59.999Z" }, "Pacific/Auckland", null],
  ])("shows %j in %s as %s", (cell, timeZone, input) => {
    expect(toDateTimeInput(cell, timeZone)).toBe(input);
  });
});

describe("fromDateTimeInput", () => {
  it.each([
    ["2026-11-15 09:00:00", NY, "2026-11-15T14:00:00.000Z"],
    ["2026-11-15 09:00:00", BERLIN, "2026-11-15T08:00:00.000Z"],
    ["2026-11-15 09:00:00", "UTC", "2026-11-15T09:00:00.000Z"],
    ["2026-03-08 02:30:00", NY, "2026-03-08T07:30:00.000Z"],
    ["2026-11-01 01:45:00", NY, "2026-11-01T05:45:00.000Z"],
  ])("reads %s typed in %s as %s", (input, timeZone, start) => {
    expect(fromDateTimeInput(input, null, timeZone)).toEqual({ start });
  });

  it("keeps the instant it has when the wall clock did not change", () => {
    const second = { start: "2026-11-01T06:30:00.000Z" };
    expect(fromDateTimeInput("2026-11-01 01:30:00", second, NY)).toBe(second);
    const withSeconds = { start: "2026-11-12T15:04:45.250Z" };
    expect(fromDateTimeInput("2026-11-12 10:04:45", withSeconds, NY)).toBe(withSeconds);
    expect(fromDateTimeInput("2026-11-12 10:05:00", withSeconds, NY)).toEqual({ start: "2026-11-12T15:05:00.000Z" });
  });

  it.each([null, "", "soon", "9999-12-31 23:00:00"])("gives no answer for %p", (input) => {
    expect(fromDateTimeInput(input, null, NY)).toBeNull();
  });
});
