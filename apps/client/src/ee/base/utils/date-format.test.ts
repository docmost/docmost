import { describe, expect, it } from "vitest";
import {
  dateTypeOptionsOf,
  formatDateCell,
  formatTimeOfDay,
  formatZoneLabel,
  resolveTimeFormat,
} from "./date-format";

const NY = "America/New_York";
const BERLIN = "Europe/Berlin";
const base = { locale: "en-US", today: "2026-11-12" };

describe("formatDateCell", () => {
  it("shows nothing for an empty cell", () => {
    expect(formatDateCell(null, { ...base, timeZone: NY })).toBe("");
  });

  it.each(["Pacific/Kiritimati", "Pacific/Honolulu", NY, BERLIN, "+05:30"])(
    "shows a date-only value as the same day in %s",
    (timeZone) => {
      expect(formatDateCell({ start: "2026-11-12" }, { ...base, timeZone })).toBe("Nov 12, 2026");
    },
  );

  it.each([
    [NY, "Nov 11, 2026 22:30"],
    [BERLIN, "Nov 12, 2026 04:30"],
    ["Pacific/Auckland", "Nov 12, 2026 16:30"],
    ["+05:30", "Nov 12, 2026 09:00"],
  ])("shows an instant on the viewer's wall clock in %s", (timeZone, text) => {
    expect(
      formatDateCell({ start: "2026-11-12T03:30:00.000Z" }, { ...base, timeZone, timeFormat: "24h" }),
    ).toBe(text);
  });

  it.each([
    ["2026-11-01T05:30:00.000Z", NY, "Nov 1, 2026 01:30"],
    ["2026-11-01T06:30:00.000Z", NY, "Nov 1, 2026 01:30"],
    ["2026-03-08T07:30:00.000Z", NY, "Mar 8, 2026 03:30"],
    ["2026-10-25T00:30:00.000Z", BERLIN, "Oct 25, 2026 02:30"],
    ["2026-10-25T01:30:00.000Z", BERLIN, "Oct 25, 2026 02:30"],
    ["2026-03-29T01:30:00.000Z", BERLIN, "Mar 29, 2026 03:30"],
  ])("shows %s on a daylight-saving day in %s as %s", (start, timeZone, text) => {
    expect(formatDateCell({ start }, { ...base, timeZone, timeFormat: "24h" })).toBe(text);
  });

  it("uses the locale's clock when the property sets no time format", () => {
    const cell = { start: "2026-11-12T03:30:00.000Z" };
    expect(formatDateCell(cell, { ...base, timeZone: BERLIN })).toMatch(/^Nov 12, 2026 4:30\sAM$/);
    expect(formatDateCell(cell, { ...base, locale: "de-DE", timeZone: BERLIN })).toBe("12. Nov. 2026 4:30");
  });

  it.each([
    ["full", "November 12, 2026"],
    ["medium", "Nov 12, 2026"],
    ["monthDayYear", "11/12/2026"],
    ["dayMonthYear", "12/11/2026"],
    ["yearMonthDay", "2026/11/12"],
    ["nope", "Nov 12, 2026"],
  ])("formats a day as %s", (dateFormat, text) => {
    expect(
      formatDateCell({ start: "2026-11-12" }, { ...base, timeZone: NY, dateFormat: dateFormat as never }),
    ).toBe(text);
  });

  it.each([
    [{ start: "2026-11-11" }, NY, "Yesterday"],
    [{ start: "2026-11-12" }, NY, "Today"],
    [{ start: "2026-11-13" }, NY, "Tomorrow"],
    [{ start: "2026-11-14" }, NY, "Nov 14, 2026"],
    [{ start: "2026-11-12T03:30:00.000Z" }, NY, "Yesterday 22:30"],
    [{ start: "2026-11-12T03:30:00.000Z" }, BERLIN, "Today 04:30"],
    [{ start: "2026-11-12T23:30:00.000Z" }, BERLIN, "Tomorrow 00:30"],
  ])("names the day of %j relative to the viewer's today in %s", (cell, timeZone, text) => {
    expect(
      formatDateCell(cell, { ...base, timeZone, dateFormat: "relative", timeFormat: "24h" }),
    ).toBe(text);
  });

  it.each([
    [{ start: "2026-11-12", end: "2026-11-15" }, NY, "Nov 12, 2026 → Nov 15, 2026"],
    [{ start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T15:30:00.000Z" }, BERLIN, "Nov 12, 2026 15:00 → 16:30"],
    [
      { start: "2026-11-12T22:00:00.000Z", end: "2026-11-12T23:30:00.000Z" },
      BERLIN,
      "Nov 12, 2026 23:00 → Nov 13, 2026 00:30",
    ],
    [{ start: "2026-11-12T22:00:00.000Z", end: "2026-11-12T23:30:00.000Z" }, NY, "Nov 12, 2026 17:00 → 18:30"],
  ])("formats the range %j in %s", (cell, timeZone, text) => {
    expect(formatDateCell(cell, { ...base, timeZone, timeFormat: "24h" })).toBe(text);
  });

  it.each([
    ["Pacific/Auckland", "Jan 1, 10000 12:59"],
    [BERLIN, "Jan 1, 10000 00:59"],
  ])("does not throw for the last instant of year 9999 in %s", (timeZone, text) => {
    expect(
      formatDateCell(
        { start: "9999-12-31T23:59:59.999Z" },
        { ...base, timeZone, dateFormat: "relative", timeFormat: "24h" },
      ),
    ).toBe(text);
  });
});

describe("formatZoneLabel", () => {
  it.each([
    ["2026-11-12T15:00:00.000Z", NY, "EST"],
    ["2026-07-12T15:00:00.000Z", NY, "EDT"],
    ["2026-11-01T05:30:00.000Z", NY, "EDT"],
    ["2026-11-01T06:30:00.000Z", NY, "EST"],
    ["2026-11-12T15:00:00.000Z", BERLIN, "GMT+1"],
    ["2026-07-12T15:00:00.000Z", BERLIN, "GMT+2"],
    ["2026-11-12T15:00:00.000Z", "+05:30", "GMT+5:30"],
    ["2026-11-12T15:00:00.000Z", "UTC", "UTC"],
  ])("labels %s in %s as %s", (instant, timeZone, label) => {
    expect(formatZoneLabel(instant, timeZone, "en-US")).toBe(label);
  });
});

describe("formatTimeOfDay and resolveTimeFormat", () => {
  it("prints the time of an instant in the given zone", () => {
    expect(
      formatTimeOfDay("2026-11-12T03:30:00.000Z", { locale: "en-US", timeZone: NY, timeFormat: "24h" }),
    ).toBe("22:30");
  });

  it("keeps the property's format and otherwise follows the locale", () => {
    expect(resolveTimeFormat("12h", "de-DE")).toBe("12h");
    expect(resolveTimeFormat(undefined, "en-US")).toBe("12h");
    expect(resolveTimeFormat(undefined, "de-DE")).toBe("24h");
  });
});

describe("dateTypeOptionsOf", () => {
  it("keeps the three known keys and nothing else", () => {
    expect(
      dateTypeOptionsOf({ dateFormat: "full", timeFormat: "24h", includeTime: true, defaultValue: "2026-01-01", junk: 1 }),
    ).toEqual({ dateFormat: "full", timeFormat: "24h", includeTime: true });
  });

  it.each([[null], [undefined], ["text"], [{ dateFormat: "nope", timeFormat: "25h", includeTime: "yes" }]])(
    "reads %j as no options",
    (typeOptions) => {
      expect(dateTypeOptionsOf(typeOptions)).toEqual({});
    },
  );
});
