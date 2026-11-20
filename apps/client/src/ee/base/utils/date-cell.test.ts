import { describe, expect, it } from "vitest";
import type { DateKind } from "@docmost/base-formula/client";
import { dateCellsEqual, partDayIn, readDateCell } from "./date-cell";

describe("readDateCell", () => {
  it.each([
    [{ start: "2026-11-12" }, "date", { start: "2026-11-12" }],
    [{ start: "2026-11-12", end: "2026-11-15" }, "date", { start: "2026-11-12", end: "2026-11-15" }],
    [{ start: "2026-11-12", end: "2026-11-12" }, "date", { start: "2026-11-12" }],
    [{ start: "2026-11-12T03:30:00.000Z" }, "datetime", { start: "2026-11-12T03:30:00.000Z" }],
    [
      { start: "2026-11-12T03:30:00.000Z", end: "2026-11-12T04:30:00.000Z" },
      "datetime",
      { start: "2026-11-12T03:30:00.000Z", end: "2026-11-12T04:30:00.000Z" },
    ],
  ])("reads %j under a %s property", (value, kind, cell) => {
    expect(readDateCell(value, kind as DateKind)).toEqual(cell);
  });

  it.each([
    [{ start: "2026-11-12T03:30:00.000Z" }, "date"],
    [{ start: "2026-11-12" }, "datetime"],
    [{ start: "2026-11-12", end: "2026-11-13T00:00:00.000Z" }, "date"],
    [{ start: "2026-11-15", end: "2026-11-12" }, "date"],
    [{ start: "2026-02-30" }, "date"],
    [{ start: "2026-11-12", extra: 1 }, "date"],
    [{}, "date"],
    [[], "date"],
    [5, "date"],
    [true, "datetime"],
    [null, "date"],
    [undefined, "datetime"],
  ])("shows %j as empty under a %s property", (value, kind) => {
    expect(readDateCell(value, kind as DateKind)).toBeNull();
  });

  it.each([
    ["2026-11-11", "date", { start: "2026-11-11" }],
    ["2026-11-11T00:00:00.000Z", "date", { start: "2026-11-11" }],
    ["2026-11-11T14:30:00.000Z", "date", { start: "2026-11-11" }],
    ["2026-11-11T14:30:00.000Z", "datetime", { start: "2026-11-11T14:30:00.000Z" }],
    ["2026-11-10T19:00:00-05:00", "datetime", { start: "2026-11-11T00:00:00.000Z" }],
    ["2026-11-11", "datetime", { start: "2026-11-11T00:00:00.000Z" }],
    ["2026-11-12T10:15:30.123Z", "datetime", { start: "2026-11-12T10:15:30.123Z" }],
  ])("reads the bare string %s under a %s property", (value, kind, cell) => {
    expect(readDateCell(value, kind as DateKind)).toEqual(cell);
  });

  it.each(["", "abc", "2026-02-30T00:00:00.000Z", "November 11, 2026"])(
    "shows the string %p as empty under either kind",
    (value) => {
      expect(readDateCell(value, "date")).toBeNull();
      expect(readDateCell(value, "datetime")).toBeNull();
    },
  );
});

describe("partDayIn", () => {
  it.each([
    ["2026-11-12", "Pacific/Kiritimati", "2026-11-12"],
    ["2026-11-12", "Pacific/Honolulu", "2026-11-12"],
    ["2026-11-12T03:30:00.000Z", "America/New_York", "2026-11-11"],
    ["2026-11-12T03:30:00.000Z", "Europe/Berlin", "2026-11-12"],
    ["2026-11-12T23:30:00.000Z", "Europe/Berlin", "2026-11-13"],
    ["2026-11-01T06:30:00.000Z", "America/New_York", "2026-11-01"],
  ])("puts %s in %s on %s", (part, timeZone, day) => {
    expect(partDayIn(part, timeZone)).toBe(day);
  });

  it.each([
    ["9999-12-31T23:59:59.999Z", "Pacific/Auckland"],
    ["0001-01-01T00:00:00.000Z", "America/New_York"],
  ])("gives no day for %s in %s, which leaves years 1 to 9999", (part, timeZone) => {
    expect(partDayIn(part, timeZone)).toBeNull();
  });
});

describe("dateCellsEqual", () => {
  it("compares start and end and treats two empty cells as equal", () => {
    expect(dateCellsEqual(null, null)).toBe(true);
    expect(dateCellsEqual({ start: "2026-11-12" }, { start: "2026-11-12", end: undefined })).toBe(true);
    expect(dateCellsEqual({ start: "2026-11-12" }, null)).toBe(false);
    expect(dateCellsEqual({ start: "2026-11-12" }, { start: "2026-11-13" })).toBe(false);
    expect(dateCellsEqual({ start: "2026-11-12" }, { start: "2026-11-12", end: "2026-11-13" })).toBe(false);
  });
});
