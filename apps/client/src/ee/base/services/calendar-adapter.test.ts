import { getMonthRange, getWeekDays, isAllDayEvent, isMultidayEvent } from "@mantine/schedule";
import { addDays } from "@docmost/base-formula/client";
import { describe, expect, it, vi } from "vitest";
import type { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

import {
  eventDayRange,
  getCalendarDateProperties,
  getCalendarWindow,
  isAllDayLane,
  isCalendarDate,
  isEditableCalendarSource,
  shiftCalendarDate,
  toCalendarEvents,
} from "./calendar-adapter";

const NY = "America/New_York";
const BERLIN = "Europe/Berlin";
const NOVEMBER = { from: "2026-11-01", to: "2026-12-12" };
const ALWAYS = { from: "0100-01-01", to: "9999-12-31" };

const property = (type: IBaseProperty["type"], typeOptions: Record<string, unknown> = {}, extra: Partial<IBaseProperty> = {}) =>
  ({ id: "due", pageId: "base-1", name: "Due", type, position: "a", typeOptions, isPrimary: false, ...extra }) as IBaseProperty;
const row = (id: string, due: unknown, extra: Partial<IBaseRow> = {}) =>
  ({
    id,
    pageId: "base-1",
    cells: { due, title: `Row ${id}` },
    position: id,
    createdAt: "2026-11-12T10:15:30.123Z",
    updatedAt: "2026-11-12T12:00:00.000Z",
    ...extra,
  }) as IBaseRow;
const draw = (rows: IBaseRow[], source: IBaseProperty, timeZone: string, window = NOVEMBER) =>
  toCalendarEvents(rows, { property: source, primaryPropertyId: "title", window, timeZone, untitledLabel: "Untitled" });
const span = (value: unknown, source: IBaseProperty, timeZone: string) =>
  draw([row("r1", value)], source, timeZone, ALWAYS).map((event) => [event.start, event.end]);

const DAY = property("date");
const TIME = property("date", { includeTime: true });

describe("calendar sources", () => {
  it("offers date properties, Created at and Last edited at, and no formula", () => {
    const properties = [DAY, property("createdAt"), property("lastEditedAt"), property("formula", { resultType: "date" }), property("text")];
    expect(getCalendarDateProperties(properties).map((p) => p.type)).toEqual(["date", "createdAt", "lastEditedAt"]);
  });

  it.each([
    [DAY, true],
    [TIME, true],
    [property("createdAt"), false],
    [property("lastEditedAt"), false],
    [property("date", {}, { pendingType: "text" }), false],
    [property("date", {}, { pendingTypeOptions: { includeTime: true } }), false],
  ])("says whether %j can be edited from the calendar", (source, editable) => {
    expect(isEditableCalendarSource(source)).toBe(editable);
  });
});

describe("the displayed day", () => {
  it.each([
    ["2026-11-12", true],
    ["0100-01-01", true],
    ["9998-12-31", true],
    ["9999-12-20", false],
    ["0099-12-31", false],
    ["2026-02-30", false],
    ["nope", false],
    [null, false],
  ])("isCalendarDate(%p) is %s", (value, ok) => {
    expect(isCalendarDate(value)).toBe(ok);
  });

  it.each([
    ["2026-01-31", "month", 1, "2026-02-01"],
    ["2026-03-31", "month", -1, "2026-02-01"],
    ["2026-12-15", "month", 1, "2027-01-01"],
    ["2026-12-29", "week", 1, "2027-01-05"],
    ["2024-03-03", "week", -1, "2024-02-25"],
    ["9998-12-31", "month", 1, "9998-12-31"],
    ["0100-01-01", "month", -1, "0100-01-01"],
    ["0100-01-03", "week", -1, "0100-01-03"],
  ])("moves %s by one %s (%i) to %s", (date, unit, step, next) => {
    expect(shiftCalendarDate(date, unit as "month" | "week", step as 1 | -1)).toBe(next);
  });
});

describe("getCalendarWindow", () => {
  it.each([
    ["month", "2026-11-12", 0, true, "2026-11-01", "2026-12-12"],
    ["month", "2026-11-12", 1, true, "2026-10-26", "2026-12-06"],
    ["month", "2026-11-30", 6, true, "2026-10-31", "2026-12-11"],
    ["month", "2026-02-01", 0, true, "2026-02-01", "2026-03-14"],
    ["month", "2024-02-29", 1, true, "2024-01-29", "2024-03-10"],
    ["month", "0100-01-01", 1, true, "0099-12-28", "0100-02-07"],
    ["month", "9998-12-31", 0, true, "9998-11-29", "9999-01-09"],
    ["mobile", "2026-11-12", 1, true, "2026-11-01", "2026-11-30"],
    ["mobile", "2024-02-29", 0, true, "2024-02-01", "2024-02-29"],
    ["mobile", "2026-12-31", 0, true, "2026-12-01", "2026-12-31"],
    ["week", "2026-11-12", 0, true, "2026-11-08", "2026-11-14"],
    ["week", "2026-11-12", 1, true, "2026-11-09", "2026-11-15"],
    ["week", "2026-11-12", 0, false, "2026-11-09", "2026-11-13"],
    ["week", "2026-11-12", 6, false, "2026-11-09", "2026-11-13"],
    ["week", "2026-11-30", 1, true, "2026-11-30", "2026-12-06"],
    ["week", "2026-12-31", 0, true, "2026-12-27", "2027-01-02"],
    ["week", "2026-11-01", 1, true, "2026-10-26", "2026-11-01"],
  ])("%s on %s, week starting %i, weekends %s", (layout, date, weekStart, showWeekends, from, to) => {
    expect(getCalendarWindow(layout as "month", date, weekStart, showWeekends)).toEqual({ from, to });
  });

  it("is the range Mantine Schedule draws, for every week start", () => {
    let day = "2026-10-15";
    for (let i = 0; i < 80; i += 1, day = addDays(day, 1)) {
      for (const weekStart of [0, 1, 2, 3, 4, 5, 6] as const) {
        for (const showWeekends of [true, false]) {
          const days = getWeekDays({ week: day, firstDayOfWeek: weekStart, weekendDays: [0, 6], withWeekendDays: showWeekends });
          expect(getCalendarWindow("week", day, weekStart, showWeekends)).toEqual({
            from: days[0].slice(0, 10),
            to: days[days.length - 1].slice(0, 10),
          });
        }
        const month = getMonthRange({ month: day, withOutsideDays: true, consistentWeeks: true, firstDayOfWeek: weekStart });
        expect(getCalendarWindow("month", day, weekStart, true)).toEqual({ from: month.start.slice(0, 10), to: month.end.slice(0, 10) });
        const mobile = getMonthRange({ month: day, withOutsideDays: false, consistentWeeks: true, firstDayOfWeek: weekStart });
        expect(getCalendarWindow("mobile", day, weekStart, true)).toEqual({ from: mobile.start.slice(0, 10), to: mobile.end.slice(0, 10) });
      }
    }
  });
});

describe("toCalendarEvents", () => {
  it.each(["Pacific/Kiritimati", "Pacific/Honolulu", NY, BERLIN])(
    "draws a date value from 00:00:00 on its first day to 23:59:59 on its last, in %s",
    (timeZone) => {
      expect(span({ start: "2026-11-12" }, DAY, timeZone)).toEqual([["2026-11-12 00:00:00", "2026-11-12 23:59:59"]]);
      expect(span({ start: "2026-11-28", end: "2026-11-30" }, DAY, timeZone)).toEqual([["2026-11-28 00:00:00", "2026-11-30 23:59:59"]]);
    },
  );

  it.each([
    [NY, "2026-11-12 10:00:00", "2026-11-12 11:30:00"],
    [BERLIN, "2026-11-12 16:00:00", "2026-11-12 17:30:00"],
    ["Pacific/Kiritimati", "2026-11-13 05:00:00", "2026-11-13 06:30:00"],
    ["Pacific/Honolulu", "2026-11-12 05:00:00", "2026-11-12 06:30:00"],
  ])("draws a date-time value on the wall clock of %s", (timeZone, start, end) => {
    expect(span({ start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:30:00.000Z" }, TIME, timeZone)).toEqual([[start, end]]);
  });

  it.each([
    ["2026-11-12T22:30:00.000Z", "2026-11-12T23:30:00.000Z", NY, "2026-11-12 17:30:00", "2026-11-12 18:30:00"],
    ["2026-11-12T22:30:00.000Z", "2026-11-12T23:30:00.000Z", BERLIN, "2026-11-12 23:30:00", "2026-11-13 00:30:00"],
    ["2026-12-01T02:30:00.000Z", "2026-12-01T03:30:00.000Z", NY, "2026-11-30 21:30:00", "2026-11-30 22:30:00"],
    ["2026-11-30T22:30:00.000Z", "2026-12-01T00:30:00.000Z", BERLIN, "2026-11-30 23:30:00", "2026-12-01 01:30:00"],
    ["2026-03-08T06:30:00.000Z", "2026-03-08T07:30:00.000Z", NY, "2026-03-08 01:30:00", "2026-03-08 03:30:00"],
    ["2026-03-29T00:30:00.000Z", "2026-03-29T01:30:00.000Z", BERLIN, "2026-03-29 01:30:00", "2026-03-29 03:30:00"],
    ["2026-11-01T05:10:00.000Z", "2026-11-01T06:50:00.000Z", NY, "2026-11-01 01:10:00", "2026-11-01 01:50:00"],
  ])("draws %s to %s in %s from %s to %s", (start, end, timeZone, from, to) => {
    expect(span({ start, end }, TIME, timeZone)).toEqual([[from, to]]);
  });

  it.each([
    ["2026-11-12T15:00:00.000Z", NY, "2026-11-12 10:00:00", "2026-11-12 11:00:00"],
    ["2026-11-12T15:00:00.000Z", BERLIN, "2026-11-12 16:00:00", "2026-11-12 17:00:00"],
    ["2026-11-13T04:40:00.000Z", NY, "2026-11-12 23:40:00", "2026-11-12 23:59:59"],
    ["2026-11-12T22:40:00.000Z", BERLIN, "2026-11-12 23:40:00", "2026-11-12 23:59:59"],
    ["2026-11-13T03:59:30.000Z", NY, "2026-11-12 22:59:30", "2026-11-12 23:59:30"],
    ["2026-11-13T04:59:59.000Z", NY, "2026-11-12 23:59:59", "2026-11-12 23:59:59"],
    ["2026-03-08T06:30:00.000Z", NY, "2026-03-08 01:30:00", "2026-03-08 02:30:00"],
  ])("gives a value with no end one hour, clamped at the end of its day: %s in %s", (start, timeZone, from, to) => {
    expect(span({ start }, TIME, timeZone)).toEqual([[from, to]]);
  });

  it.each([
    ["2026-11-01T05:50:00.000Z", "2026-11-01T06:10:00.000Z", NY, "2026-11-01 01:50:00", "2026-11-01 02:50:00"],
    ["2026-10-25T00:50:00.000Z", "2026-10-25T01:10:00.000Z", BERLIN, "2026-10-25 02:50:00", "2026-10-25 03:50:00"],
  ])("draws a value whose wall-clock end is not after its start like one with no end", (start, end, timeZone, from, to) => {
    expect(span({ start, end }, TIME, timeZone)).toEqual([[from, to]]);
  });

  it("never hands the library an end before its start", () => {
    const starts = ["2026-03-08T06:30:00.000Z", "2026-11-01T05:50:00.000Z", "2026-10-25T00:50:00.000Z", "2026-11-13T04:59:59.000Z"];
    const rows = starts.flatMap((start, i) => [
      row(`a${i}`, { start }),
      row(`b${i}`, { start, end: new Date(Date.parse(start) + 20 * 60_000).toISOString() }),
    ]);
    for (const timeZone of [NY, BERLIN, "Pacific/Kiritimati", "UTC"]) {
      for (const event of draw(rows, TIME, timeZone, ALWAYS)) expect(event.end >= event.start).toBe(true);
    }
  });

  it("takes the kind from the property, never from the value", () => {
    expect(span({ start: "2026-11-12T15:00:00.000Z" }, DAY, NY)).toEqual([]);
    expect(span({ start: "2026-11-12" }, TIME, NY)).toEqual([]);
    expect(span("2026-11-11T00:00:00.000Z", DAY, "Pacific/Honolulu")).toEqual([["2026-11-11 00:00:00", "2026-11-11 23:59:59"]]);
  });

  it("keeps the row, the kind and the stored value in the payload", () => {
    const value = { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:30:00.000Z" };
    const [event] = draw([row("r1", value)], TIME, NY);
    expect(event).toMatchObject({ id: "r1", title: "Row r1", color: "blue" });
    expect(event.payload).toEqual({ rowId: "r1", kind: "datetime", value, readOnly: false });
  });

  it.each([
    ["createdAt", "2026-11-12T10:15:30.123Z", "2026-11-12 05:15:30", "2026-11-12 06:15:30"],
    ["lastEditedAt", "2026-11-12T12:00:00.000Z", "2026-11-12 07:00:00", "2026-11-12 08:00:00"],
  ])("draws %s as a read-only instant", (type, instant, from, to) => {
    const [event] = draw([row("r1", undefined)], property(type as "createdAt"), NY);
    expect([event.start, event.end]).toEqual([from, to]);
    expect(event.payload).toEqual({ rowId: "r1", kind: "datetime", value: { start: instant }, readOnly: true });
  });

  it("marks the events of a converting property read-only", () => {
    const [event] = draw([row("r1", { start: "2026-11-12" })], property("date", {}, { pendingTypeOptions: { includeTime: true } }), NY);
    expect(event.payload.readOnly).toBe(true);
  });

  it("draws only what overlaps the window", () => {
    const days = [
      row("before", { start: "2026-10-31" }),
      row("touchesStart", { start: "2026-10-30", end: "2026-11-01" }),
      row("lastDay", { start: "2026-12-12" }),
      row("after", { start: "2026-12-13" }),
    ];
    expect(draw(days, DAY, NY).map((event) => event.id)).toEqual(["touchesStart", "lastDay"]);

    const instants = [row("early", { start: "2026-11-01T03:30:00.000Z" }), row("late", { start: "2026-12-13T04:30:00.000Z" })];
    expect(draw(instants, TIME, NY).map((event) => event.id)).toEqual(["late"]);
    expect(draw(instants, TIME, BERLIN).map((event) => event.id)).toEqual(["early"]);
  });

  it("draws each row once, earliest first and the longer of two that start together first", () => {
    const rows = [
      row("r1", { start: "2026-11-12" }),
      row("r2", { start: "2026-11-10", end: "2026-11-11" }),
      row("r3", { start: "2026-11-10", end: "2026-11-14" }),
      row("r1", { start: "2026-11-20" }),
    ];
    expect(draw(rows, DAY, NY).map((event) => event.id)).toEqual(["r3", "r2", "r1"]);
  });

  it("uses the untitled label when the title is empty", () => {
    const [event] = draw([{ ...row("r1", { start: "2026-11-12" }), cells: { due: { start: "2026-11-12" }, title: "  " } }], DAY, NY);
    expect(event.title).toBe("Untitled");
  });

  it("skips a value with no wall clock in years 1 to 9999 and draws nothing for a formula", () => {
    expect(span({ start: "9999-12-31T23:59:59.999Z" }, TIME, "Pacific/Auckland")).toEqual([]);
    expect(draw([row("r1", { start: "2026-11-12" })], property("formula", { resultType: "date" }), NY)).toEqual([]);
  });
});

const SHAPES: [string, string, [string, string], boolean][] = [
  ["2026-11-12 00:00:00", "2026-11-12 23:59:59", ["2026-11-12", "2026-11-12"], true],
  ["2026-11-12 00:00:00", "2026-11-14 23:59:59", ["2026-11-12", "2026-11-14"], true],
  ["2026-11-12 00:00:00", "2026-11-13 00:00:00", ["2026-11-12", "2026-11-12"], true],
  ["2026-11-12 00:00:00", "2026-11-14 00:00:00", ["2026-11-12", "2026-11-13"], true],
  ["2026-11-12 10:00:00", "2026-11-12 11:00:00", ["2026-11-12", "2026-11-12"], false],
  ["2026-11-12 00:00:00", "2026-11-12 01:00:00", ["2026-11-12", "2026-11-12"], false],
  ["2026-11-12 22:00:00", "2026-11-13 00:00:00", ["2026-11-12", "2026-11-12"], false],
  ["2026-11-12 23:40:00", "2026-11-12 23:59:59", ["2026-11-12", "2026-11-12"], false],
  ["2026-11-12 23:30:00", "2026-11-13 00:30:00", ["2026-11-12", "2026-11-13"], true],
  ["2026-11-12 10:00:00", "2026-11-14 09:00:00", ["2026-11-12", "2026-11-14"], true],
  ["2026-11-30 23:30:00", "2026-12-01 01:30:00", ["2026-11-30", "2026-12-01"], true],
];

describe("what the library infers from an event's strings", () => {
  it.each(SHAPES)("%s to %s covers %j, all-day lane %s", (start, end, days, lane) => {
    expect(eventDayRange({ start, end })).toEqual(days);
    expect(isAllDayLane({ start, end })).toBe(lane);
  });

  it.each(SHAPES)("Mantine Schedule agrees about the lane of %s to %s", (start, end, _days, lane) => {
    const event = { id: "e", title: "e", start, end, color: "blue" };
    expect(isMultidayEvent(event) || isAllDayEvent({ event, date: start })).toBe(lane);
  });

  it("reads an end in the first minute of a day as the week view and the month view each do", () => {
    const event = { start: "2026-11-12 23:00:00", end: "2026-11-13 00:00:30" };
    expect(isAllDayLane(event)).toBe(false);
    expect(eventDayRange(event)).toEqual(["2026-11-12", "2026-11-13"]);
  });
});
