import { calculateDropTime, getMonthRange, getWeekDays, isAllDayEvent, isMultidayEvent } from "@mantine/schedule";
import { addDays, type DateCell, type DateKind } from "@docmost/base-formula/client";
import { describe, expect, it, vi } from "vitest";
import type { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

import {
  createOnDays,
  createOnSlots,
  dropOnMonth,
  dropOnWeek,
  eventDayRange,
  getCalendarDateProperties,
  getCalendarWindow,
  isAllDayLane,
  isCalendarDate,
  isEditableCalendarSource,
  isStaleCalendarEvent,
  resizeDayRange,
  resizeOnMonth,
  resizeOnWeek,
  shiftCalendarDate,
  slotTimeAt,
  toCalendarEvents,
  type CalendarEvent,
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

function eventOf(value: DateCell, kind: DateKind, timeZone: string): CalendarEvent {
  return draw([row("r1", value)], kind === "date" ? DAY : TIME, timeZone, ALWAYS)[0];
}
const readOnlyEvent = (timeZone: string) =>
  draw([row("r1", undefined)], property("createdAt"), timeZone, ALWAYS)[0];

describe("dropOnMonth", () => {
  it.each(["Pacific/Kiritimati", "Pacific/Honolulu"])(
    "moves both days of a date value by the days the pointer moved, in %s",
    (timeZone) => {
      const event = eventOf({ start: "2026-11-12", end: "2026-11-14" }, "date", timeZone);
      expect(dropOnMonth(event, "2026-11-20 00:00:00", "2026-11-13", timeZone)).toEqual({ start: "2026-11-19", end: "2026-11-21" });
      expect(dropOnMonth(event, "2026-11-20 00:00:00", null, timeZone)).toEqual({ start: "2026-11-20", end: "2026-11-22" });
    },
  );

  it.each([
    [{ start: "2026-01-30", end: "2026-01-31" }, "2026-01-30", "2026-01-31 00:00:00", { start: "2026-01-31", end: "2026-02-01" }],
    [{ start: "2024-02-28" }, "2024-02-28", "2024-02-29 00:00:00", { start: "2024-02-29" }],
    [{ start: "2026-12-31" }, "2026-12-31", "2027-01-01 00:00:00", { start: "2027-01-01" }],
    [{ start: "2026-03-07", end: "2026-03-09" }, "2026-03-07", "2026-03-08 00:00:00", { start: "2026-03-08", end: "2026-03-10" }],
    [{ start: "2026-03-07", end: "2026-03-09" }, "2026-03-07", "2026-02-28 00:00:00", { start: "2026-02-28", end: "2026-03-02" }],
  ])("moves the date value %j from %s to %s", (value, grabbed, newStart, moved) => {
    expect(dropOnMonth(eventOf(value, "date", NY), newStart, grabbed, NY)).toEqual(moved);
  });

  it.each([
    [{ start: "2026-03-07T15:00:00.000Z", end: "2026-03-07T16:00:00.000Z" }, NY, "2026-03-07", "2026-03-08 10:00:00", { start: "2026-03-08T14:00:00.000Z", end: "2026-03-08T15:00:00.000Z" }],
    [{ start: "2026-03-28T09:00:00.000Z" }, BERLIN, "2026-03-28", "2026-03-29 10:00:00", { start: "2026-03-29T08:00:00.000Z" }],
    [{ start: "2026-10-31T14:00:00.000Z", end: "2026-10-31T15:30:00.000Z" }, NY, "2026-10-31", "2026-11-01 10:00:00", { start: "2026-11-01T15:00:00.000Z", end: "2026-11-01T16:30:00.000Z" }],
    [{ start: "2026-10-24T08:00:00.000Z", end: "2026-10-24T09:30:00.000Z" }, BERLIN, "2026-10-24", "2026-10-25 10:00:00", { start: "2026-10-25T09:00:00.000Z", end: "2026-10-25T10:30:00.000Z" }],
    [{ start: "2026-03-07T07:30:00.000Z" }, NY, "2026-03-07", "2026-03-08 02:30:00", { start: "2026-03-08T07:30:00.000Z" }],
    [{ start: "2026-01-31T15:00:45.250Z", end: "2026-01-31T17:00:00.000Z" }, NY, "2026-01-31", "2026-02-01 10:00:45", { start: "2026-02-01T15:00:45.250Z", end: "2026-02-01T17:00:00.000Z" }],
    [{ start: "2026-11-12T22:30:00.000Z", end: "2026-11-12T23:30:00.000Z" }, BERLIN, "2026-11-12", "2026-11-14 23:30:00", { start: "2026-11-14T22:30:00.000Z", end: "2026-11-14T23:30:00.000Z" }],
  ])("moves the date-time value %j in %s by calendar days, keeping the wall clock", (value, timeZone, grabbed, newStart, moved) => {
    expect(dropOnMonth(eventOf(value, "datetime", timeZone), newStart, grabbed, timeZone)).toEqual(moved);
  });

  it("keeps the elapsed length when the moved end would not be after the moved start", () => {
    const event = eventOf({ start: "2026-11-01T05:50:00.000Z", end: "2026-11-01T06:10:00.000Z" }, "datetime", NY);
    expect(dropOnMonth(event, "2026-11-02 01:50:00", "2026-11-01", NY)).toEqual({
      start: "2026-11-02T06:50:00.000Z",
      end: "2026-11-02T07:10:00.000Z",
    });
  });

  it("writes nothing for the same day, a read-only source or a move past year 9999", () => {
    const event = eventOf({ start: "2026-11-12", end: "2026-11-14" }, "date", NY);
    expect(dropOnMonth(event, "2026-11-13 00:00:00", "2026-11-13", NY)).toBeNull();
    expect(dropOnMonth(readOnlyEvent(NY), "2026-11-20 05:15:30", "2026-11-12", NY)).toBeNull();
    const last = eventOf({ start: "9999-12-31T04:00:00.000Z" }, "datetime", NY);
    expect(dropOnMonth(last, "9999-12-31 23:00:00", "9999-12-30", NY)).toBeNull();
  });
});

describe("dropOnWeek", () => {
  const hour = { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:00:00.000Z" };
  const grid = (value: DateCell, timeZone: string, grabTime: string | null, newStart: string) =>
    dropOnWeek(eventOf(value, "datetime", timeZone), newStart, { day: null, time: grabTime }, timeZone);

  it("moves a date value by days in the all-day lane", () => {
    const event = eventOf({ start: "2026-11-12" }, "date", NY);
    expect(dropOnWeek(event, "2026-11-14 00:00:00", { day: "2026-11-12", time: null }, NY)).toEqual({ start: "2026-11-14" });
  });

  it("moves a date-time value that the library put in the all-day lane by days, as a date-time", () => {
    const event = eventOf({ start: "2026-11-12T22:30:00.000Z", end: "2026-11-12T23:30:00.000Z" }, "datetime", BERLIN);
    expect(dropOnWeek(event, "2026-11-14 00:00:00", { day: "2026-11-13", time: null }, BERLIN)).toEqual({
      start: "2026-11-13T22:30:00.000Z",
      end: "2026-11-13T23:30:00.000Z",
    });
  });

  it.each([
    ["one day and 4 h 07 later snaps to 4 h", hour, NY, "2026-11-12 10:20:00", "2026-11-13 14:27:00", { start: "2026-11-13T19:00:00.000Z", end: "2026-11-13T20:00:00.000Z" }],
    ["8 minutes snaps to 15", hour, NY, "2026-11-12 10:20:00", "2026-11-12 10:28:00", { start: "2026-11-12T15:15:00.000Z", end: "2026-11-12T16:15:00.000Z" }],
    ["with no grab time the start lands on the drop", hour, NY, null, "2026-11-12 13:00:00", { start: "2026-11-12T18:00:00.000Z", end: "2026-11-12T19:00:00.000Z" }],
    ["a start before the drop day is held at 00:00", hour, NY, "2026-11-12 10:50:00", "2026-11-13 00:10:00", { start: "2026-11-13T05:00:00.000Z", end: "2026-11-13T06:00:00.000Z" }],
    ["a start past the drop day is held at 23:58", hour, NY, "2026-11-12 10:00:00", "2026-11-13 23:58:00", { start: "2026-11-14T04:58:00.000Z", end: "2026-11-14T05:58:00.000Z" }],
    ["so is the start of a value with no end", { start: hour.start }, NY, "2026-11-12 10:00:00", "2026-11-13 23:58:00", { start: "2026-11-14T04:58:00.000Z" }],
    ["seconds and milliseconds survive", { start: "2026-11-12T15:04:45.250Z", end: "2026-11-12T16:04:45.250Z" }, NY, "2026-11-12 10:04:00", "2026-11-12 12:04:00", { start: "2026-11-12T17:04:45.250Z", end: "2026-11-12T18:04:45.250Z" }],
    ["the same time on a 23 hour day", { start: "2026-03-07T15:00:00.000Z", end: "2026-03-07T16:00:00.000Z" }, NY, "2026-03-07 10:20:00", "2026-03-08 10:20:00", { start: "2026-03-08T14:00:00.000Z", end: "2026-03-08T15:00:00.000Z" }],
    ["a time in the missing hour moves forward", { start: "2026-03-07T15:00:00.000Z", end: "2026-03-07T16:00:00.000Z" }, NY, "2026-03-07 10:00:00", "2026-03-08 02:30:00", { start: "2026-03-08T07:30:00.000Z", end: "2026-03-08T08:30:00.000Z" }],
    ["a time in the repeated hour is its first occurrence", { start: "2026-10-24T08:00:00.000Z", end: "2026-10-24T09:00:00.000Z" }, BERLIN, "2026-10-24 10:00:00", "2026-10-25 02:30:00", { start: "2026-10-25T00:30:00.000Z", end: "2026-10-25T01:30:00.000Z" }],
    ["the same time on a 25 hour day", { start: "2026-10-24T08:00:00.000Z", end: "2026-10-24T09:00:00.000Z" }, BERLIN, "2026-10-24 10:00:00", "2026-10-25 10:00:00", { start: "2026-10-25T09:00:00.000Z", end: "2026-10-25T10:00:00.000Z" }],
  ])("in the time grid, %s", (_name, value, timeZone, grabTime, newStart, moved) => {
    expect(grid(value, timeZone, grabTime, newStart)).toEqual(moved);
  });

  it("writes nothing for a move of 7 minutes or less, or on a read-only source", () => {
    expect(grid(hour, NY, "2026-11-12 10:20:00", "2026-11-12 10:27:00")).toBeNull();
    expect(dropOnWeek(readOnlyEvent(NY), "2026-11-13 14:00:00", { day: null, time: "2026-11-12 05:15:00" }, NY)).toBeNull();
  });
});

describe("the morning the clocks go forward in New York", () => {
  const value = { start: "2026-03-08T07:30:00.000Z" };

  it("draws the value on 8 March at 03:30, the wall clock Temporal gives", () => {
    expect(span(value, TIME, NY)).toEqual([["2026-03-08 03:30:00", "2026-03-08 04:30:00"]]);
  });

  it("a week grid drop one day later writes the same wall-clock time on 9 March", () => {
    const event = eventOf(value, "datetime", NY);
    expect(dropOnWeek(event, "2026-03-09 03:30:00", { day: "2026-03-08", time: "2026-03-08 03:30:00" }, NY)).toEqual({
      start: "2026-03-09T07:30:00.000Z",
    });
  });

  it("a month drop one day later writes the same wall-clock time on 9 March", () => {
    const event = eventOf(value, "datetime", NY);
    expect(dropOnMonth(event, "2026-03-09 03:30:00", "2026-03-08", NY)).toEqual({ start: "2026-03-09T07:30:00.000Z" });
  });
});

describe("slotTimeAt", () => {
  it.each([
    ["2026-11-13", "14:00:00", 24 / 64, "2026-11-13 14:23:00"],
    ["2026-11-13", "23:00:00", 63.9 / 64, "2026-11-13 23:58:00"],
    ["2026-11-13", "00:00:00", 0, "2026-11-13 00:00:00"],
    ["2026-11-12", "10:00:00", 0.34, "2026-11-12 10:20:00"],
    ["2026-11-12", "09:00:00", 0.5, "2026-11-12 09:30:00"],
  ])("is the time Mantine Schedule would drop at: %s %s + %f", (day, slotTime, fraction, time) => {
    expect(slotTimeAt(day, slotTime, fraction)).toBe(time);
    const { start } = calculateDropTime({
      draggedEvent: { id: "e", title: "e", start: `${day} ${slotTime}`, end: `${day} ${slotTime}`, color: "blue" },
      targetDate: day,
      targetSlotTime: slotTime,
      intervalMinutes: 60,
      dragIntervalMinutes: 1,
      slotOffset: fraction * 64,
      slotSize: 64,
      startTime: "00:00:00",
      endTime: "23:59:59",
    });
    const two = (n: number) => String(n).padStart(2, "0");
    expect(`${two(start.getHours())}:${two(start.getMinutes())}`).toBe(time.slice(11, 16));
  });
});

describe("resizeOnWeek", () => {
  it.each([
    ["the end edge", { start: "2026-11-12T15:00:30.500Z", end: "2026-11-12T16:00:00.000Z" }, NY, null, "2026-11-12 12:15:00", { start: "2026-11-12T15:00:30.500Z", end: "2026-11-12T17:15:00.000Z" }],
    ["the start edge", { start: "2026-11-12T15:00:30.500Z", end: "2026-11-12T16:00:00.000Z" }, NY, "2026-11-12 09:30:00", null, { start: "2026-11-12T14:30:00.000Z", end: "2026-11-12T16:00:00.000Z" }],
    ["the end edge of a value with no end", { start: "2026-11-12T15:00:00.000Z" }, NY, null, "2026-11-12 11:45:00", { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:45:00.000Z" }],
    ["the start edge of a value with no end keeps the end it was drawn with", { start: "2026-11-12T15:00:00.000Z" }, NY, "2026-11-12 09:30:00", null, { start: "2026-11-12T14:30:00.000Z", end: "2026-11-12T16:00:00.000Z" }],
    ["an end in the missing hour moves forward", { start: "2026-03-08T06:00:00.000Z", end: "2026-03-08T08:00:00.000Z" }, NY, null, "2026-03-08 02:30:00", { start: "2026-03-08T06:00:00.000Z", end: "2026-03-08T07:30:00.000Z" }],
    ["a start in the missing hour moves forward", { start: "2026-03-08T06:00:00.000Z", end: "2026-03-08T08:00:00.000Z" }, NY, "2026-03-08 02:15:00", null, { start: "2026-03-08T07:15:00.000Z", end: "2026-03-08T08:00:00.000Z" }],
    ["an end that is no longer after the start is dropped", { start: "2026-03-08T06:30:00.000Z", end: "2026-03-08T07:15:00.000Z" }, NY, "2026-03-08 02:45:00", null, { start: "2026-03-08T07:45:00.000Z" }],
    ["a start in the repeated hour is its first occurrence", { start: "2026-10-25T07:00:00.000Z", end: "2026-10-25T09:00:00.000Z" }, BERLIN, "2026-10-25 02:30:00", null, { start: "2026-10-25T00:30:00.000Z", end: "2026-10-25T09:00:00.000Z" }],
  ])("%s", (_name, value, timeZone, newStart, newEnd, resized) => {
    const event = eventOf(value, "datetime", timeZone);
    expect(resizeOnWeek(event, newStart ?? event.start, newEnd ?? event.end, timeZone)).toEqual(resized);
  });

  it("writes nothing when neither edge moved, for a date value, or on a read-only source", () => {
    const event = eventOf({ start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:00:00.000Z" }, "datetime", NY);
    expect(resizeOnWeek(event, event.start, event.end, NY)).toBeNull();
    const day = eventOf({ start: "2026-11-12" }, "date", NY);
    expect(resizeOnWeek(day, "2026-11-12 09:00:00", day.end, NY)).toBeNull();
    const system = readOnlyEvent(NY);
    expect(resizeOnWeek(system, system.start, "2026-11-12 09:00:00", NY)).toBeNull();
  });
});

describe("resizeOnMonth", () => {
  it.each([
    ["date", { start: "2026-11-12" }, NY, "end", "2026-11-14", { start: "2026-11-12", end: "2026-11-14" }],
    ["date", { start: "2026-11-12" }, NY, "start", "2026-11-10", { start: "2026-11-10", end: "2026-11-12" }],
    ["date", { start: "2026-11-12", end: "2026-11-14" }, NY, "start", "2026-11-14", { start: "2026-11-14" }],
    ["date", { start: "2026-11-12", end: "2026-11-14" }, NY, "end", "2026-11-12", { start: "2026-11-12" }],
    ["date", { start: "2026-11-12", end: "2026-11-14" }, NY, "end", "2026-11-30", { start: "2026-11-12", end: "2026-11-30" }],
    ["datetime", { start: "2026-11-12T15:00:00.000Z" }, NY, "end", "2026-11-14", { start: "2026-11-12T15:00:00.000Z", end: "2026-11-14T16:00:00.000Z" }],
    ["datetime", { start: "2026-11-12T15:00:00.000Z" }, NY, "start", "2026-11-11", { start: "2026-11-11T15:00:00.000Z", end: "2026-11-12T16:00:00.000Z" }],
    ["datetime", { start: "2026-03-06T15:00:00.000Z", end: "2026-03-07T16:00:00.000Z" }, NY, "end", "2026-03-08", { start: "2026-03-06T15:00:00.000Z", end: "2026-03-08T15:00:00.000Z" }],
    ["datetime", { start: "2026-03-06T15:00:00.000Z", end: "2026-03-07T16:00:00.000Z" }, NY, "start", "2026-03-07", { start: "2026-03-07T15:00:00.000Z", end: "2026-03-07T16:00:00.000Z" }],
    ["datetime", { start: "2026-10-23T08:00:00.000Z", end: "2026-10-24T09:00:00.000Z" }, BERLIN, "end", "2026-10-25", { start: "2026-10-23T08:00:00.000Z", end: "2026-10-25T10:00:00.000Z" }],
  ])("a %s value %j in %s, %s edge to %s", (kind, value, timeZone, edge, toDay, resized) => {
    expect(resizeOnMonth(eventOf(value, kind as DateKind, timeZone), edge as "start" | "end", toDay, timeZone)).toEqual(resized);
  });

  it("writes nothing when the edge stays on its day or the source is read-only", () => {
    const event = eventOf({ start: "2026-11-12", end: "2026-11-14" }, "date", NY);
    expect(resizeOnMonth(event, "end", "2026-11-14", NY)).toBeNull();
    expect(resizeOnMonth(readOnlyEvent(NY), "end", "2026-11-14", NY)).toBeNull();
  });

  it("previews a day range that never turns inside out", () => {
    const range: [string, string] = ["2026-11-12", "2026-11-14"];
    expect(resizeDayRange(range, "start", "2026-11-13")).toEqual(["2026-11-13", "2026-11-14"]);
    expect(resizeDayRange(range, "start", "2026-11-20")).toEqual(["2026-11-14", "2026-11-14"]);
    expect(resizeDayRange(range, "end", "2026-11-30")).toEqual(["2026-11-12", "2026-11-30"]);
    expect(resizeDayRange(range, "end", "2026-11-01")).toEqual(["2026-11-12", "2026-11-12"]);
  });

  it.each([
    ["date", { start: "2026-11-12", end: "2026-11-14" }, "start", "2026-11-20", { start: "2026-11-14" }],
    ["date", { start: "2026-11-12", end: "2026-11-14" }, "end", "2026-11-01", { start: "2026-11-12" }],
    ["datetime", { start: "2026-11-12T15:00:00.000Z", end: "2026-11-14T16:00:00.000Z" }, "start", "2026-11-20", { start: "2026-11-14T15:00:00.000Z", end: "2026-11-14T16:00:00.000Z" }],
    ["datetime", { start: "2026-11-12T15:00:00.000Z", end: "2026-11-14T16:00:00.000Z" }, "end", "2026-11-01", { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:00:00.000Z" }],
  ])("holds a %s value %j at the other edge's day when the %s edge passes it to %s in New York", (kind, value, edge, toDay, resized) => {
    expect(resizeOnMonth(eventOf(value, kind as DateKind, NY), edge as "start" | "end", toDay, NY)).toEqual(resized);
  });

  it("saves the day range it previews", () => {
    let seed = 20261112;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const two = (n: number) => String(n).padStart(2, "0");
    for (let i = 0; i < 400; i += 1) {
      const kind: DateKind = random(2) === 0 ? "date" : "datetime";
      const timeZone = [NY, BERLIN, "Pacific/Kiritimati", "Pacific/Honolulu"][random(4)];
      const firstDay = addDays("2026-02-20", random(300));
      const value: DateCell =
        kind === "date"
          ? random(3) === 0
            ? { start: firstDay }
            : { start: firstDay, end: addDays(firstDay, 1 + random(6)) }
          : (() => {
              const start = `${firstDay}T${two(random(24))}:${two(random(4) * 15)}:00.000Z`;
              return random(3) === 0
                ? { start }
                : { start, end: new Date(Date.parse(start) + (1 + random(6 * 96)) * 15 * 60_000).toISOString() };
            })();
      const event = eventOf(value, kind, timeZone);
      const edge = random(2) === 0 ? "start" : "end";
      const toDay = addDays(event.start.slice(0, 10), random(17) - 8);
      const shown = resizeDayRange(eventDayRange(event), edge, toDay);
      const saved = resizeOnMonth(event, edge, toDay, timeZone) ?? value;
      expect([i, eventDayRange(eventOf(saved, kind, timeZone))]).toEqual([i, shown]);
    }
  });
});

describe("isStaleCalendarEvent", () => {
  it("says an event drawn for another kind than the property's current one is stale", () => {
    const day = eventOf({ start: "2026-11-12" }, "date", NY);
    const time = eventOf({ start: "2026-11-12T15:00:00.000Z" }, "datetime", NY);
    expect(isStaleCalendarEvent(day, "date")).toBe(false);
    expect(isStaleCalendarEvent(day, "datetime")).toBe(true);
    expect(isStaleCalendarEvent(time, "datetime")).toBe(false);
    expect(isStaleCalendarEvent(time, "date")).toBe(true);
  });
});

describe("creating from the calendar", () => {
  it.each([
    ["Pacific/Kiritimati", "2026-11-11T19:00:00.000Z"],
    ["Pacific/Honolulu", "2026-11-12T19:00:00.000Z"],
    [NY, "2026-11-12T14:00:00.000Z"],
    [BERLIN, "2026-11-12T08:00:00.000Z"],
  ])("a clicked day is that day for a date property and 09:00 in %s for a date-time property", (timeZone, start) => {
    expect(createOnDays("date", "2026-11-12", "2026-11-12", timeZone)).toEqual({ start: "2026-11-12" });
    expect(createOnDays("datetime", "2026-11-12", "2026-11-12", timeZone)).toEqual({ start });
  });

  it.each([
    ["date", "2026-11-12 00:00:00", "2026-11-14 23:59:59", NY, { start: "2026-11-12", end: "2026-11-14" }],
    ["date", "2026-11-14 00:00:00", "2026-11-12 23:59:59", NY, { start: "2026-11-12", end: "2026-11-14" }],
    ["date", "2026-11-29", "2026-12-02", NY, { start: "2026-11-29", end: "2026-12-02" }],
    ["datetime", "2026-11-12 00:00:00", "2026-11-14 23:59:59", NY, { start: "2026-11-12T14:00:00.000Z", end: "2026-11-14T14:00:00.000Z" }],
    ["datetime", "2026-03-07", "2026-03-09", NY, { start: "2026-03-07T14:00:00.000Z", end: "2026-03-09T13:00:00.000Z" }],
    ["datetime", "2026-10-24", "2026-10-26", BERLIN, { start: "2026-10-24T07:00:00.000Z", end: "2026-10-26T08:00:00.000Z" }],
  ])("selected days become a %s value: %s to %s in %s", (kind, rangeStart, rangeEnd, timeZone, value) => {
    expect(createOnDays(kind as DateKind, rangeStart, rangeEnd, timeZone)).toEqual(value);
  });

  it.each([
    ["datetime", "2026-11-12 10:00:00", "2026-11-12 11:00:00", NY, { start: "2026-11-12T15:00:00.000Z", end: "2026-11-12T16:00:00.000Z" }],
    ["datetime", "2026-11-12 10:00:00", "2026-11-12 11:00:00", BERLIN, { start: "2026-11-12T09:00:00.000Z", end: "2026-11-12T10:00:00.000Z" }],
    ["datetime", "2026-11-12 09:00:00", "2026-11-12 12:00:00", NY, { start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T17:00:00.000Z" }],
    ["datetime", "2026-11-12 23:00:00", "2026-11-12 23:59:59", NY, { start: "2026-11-13T04:00:00.000Z", end: "2026-11-13T04:59:59.000Z" }],
    ["datetime", "2026-03-08 02:00:00", "2026-03-08 03:00:00", NY, { start: "2026-03-08T07:00:00.000Z" }],
    ["datetime", "2026-03-08 01:00:00", "2026-03-08 02:00:00", NY, { start: "2026-03-08T06:00:00.000Z", end: "2026-03-08T07:00:00.000Z" }],
    ["datetime", "2026-10-25 02:00:00", "2026-10-25 03:00:00", BERLIN, { start: "2026-10-25T00:00:00.000Z", end: "2026-10-25T02:00:00.000Z" }],
    ["date", "2026-11-12 10:00:00", "2026-11-12 11:00:00", NY, { start: "2026-11-12" }],
  ])("time slots become a %s value: %s to %s in %s", (kind, rangeStart, rangeEnd, timeZone, value) => {
    expect(createOnSlots(kind as DateKind, rangeStart, rangeEnd, timeZone)).toEqual(value);
  });

  it.each([
    ["the last hour of 9999-12-31", () => createOnSlots("datetime", "9999-12-31 23:00:00", "9999-12-31 23:59:59", NY)],
    ["0000-01-01 at 09:00", () => createOnDays("datetime", "0000-01-01", "0000-01-01", "Asia/Tokyo")],
    ["the first hour of 0000-01-01", () => createOnSlots("datetime", "0000-01-01 00:00:00", "0000-01-01 00:59:59", "Asia/Tokyo")],
  ])("writes nothing for a date-time at %s, an instant past the years the date module holds", (_name, create) => {
    expect(create).not.toThrow();
    expect(create()).toBeNull();
  });

  it("creates on the last and first days of the range when the instant is inside it", () => {
    expect(createOnDays("date", "9999-12-31", "9999-12-31", "Asia/Tokyo")).toEqual({ start: "9999-12-31" });
    expect(createOnSlots("date", "9999-12-31 23:00:00", "9999-12-31 23:59:59", "Asia/Tokyo")).toEqual({ start: "9999-12-31" });
    expect(createOnSlots("datetime", "9999-12-31 23:00:00", "9999-12-31 23:59:59", "Asia/Tokyo")).toEqual({
      start: "9999-12-31T14:00:00.000Z",
      end: "9999-12-31T14:59:59.000Z",
    });
    expect(createOnDays("date", "0000-01-01", "0000-01-01", "Asia/Tokyo")).toEqual({ start: "0000-01-01" });
  });
});
