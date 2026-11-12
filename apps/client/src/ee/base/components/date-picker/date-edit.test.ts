import { describe, expect, it } from "vitest";
import type { DateCell, DateKind } from "@docmost/base-formula/client";
import { pickDay, setTimeOfDay } from "./date-edit";

const NY = "America/New_York";
const BERLIN = "Europe/Berlin";

describe("pickDay", () => {
  it.each([
    ["date", "Pacific/Kiritimati", { start: "2026-11-12" }],
    ["date", "Pacific/Honolulu", { start: "2026-11-12" }],
    ["datetime", NY, { start: "2026-11-12T14:00:00.000Z" }],
    ["datetime", BERLIN, { start: "2026-11-12T08:00:00.000Z" }],
    ["datetime", "+05:30", { start: "2026-11-12T03:30:00.000Z" }],
  ])("starts an empty %s cell in %s", (kind, zone, cell) => {
    expect(
      pickDay({ current: null, kind: kind as DateKind, endpoint: "start", withEnd: false, ymd: "2026-11-12", zone }),
    ).toEqual(cell);
  });

  it("gives a new date-time range one hour and a new date range no end yet", () => {
    const args = { current: null, endpoint: "start" as const, withEnd: true, ymd: "2026-11-12", zone: NY };
    expect(pickDay({ ...args, kind: "datetime" })).toEqual({
      start: "2026-11-12T14:00:00.000Z",
      end: "2026-11-12T15:00:00.000Z",
    });
    expect(pickDay({ ...args, kind: "date" })).toEqual({ start: "2026-11-12" });
  });

  it.each([
    ["the second 01:30 in New York", "2026-11-01T06:30:00.000Z", "2026-11-01", NY],
    ["the second 02:30 in Berlin", "2026-10-25T01:30:00.000Z", "2026-10-25", BERLIN],
  ])("returns the same instant when %s is clicked on its own day", (_name, start, ymd, zone) => {
    const current = { start };
    expect(pickDay({ current, kind: "datetime", endpoint: "start", withEnd: false, ymd, zone })).toEqual(current);
  });

  const move = (start: string, ymd: string, zone: string) =>
    pickDay({ current: { start }, kind: "datetime", endpoint: "start", withEnd: false, ymd, zone });

  it.each([
    ["2026-11-12T15:04:45.250Z", "2026-11-20", NY, "2026-11-20T15:04:45.250Z"],
    ["2026-10-30T13:15:45.000Z", "2026-11-02", NY, "2026-11-02T14:15:45.000Z"],
    ["2026-03-28T14:04:45.250Z", "2026-03-29", BERLIN, "2026-03-29T13:04:45.250Z"],
  ])("moves %s to %s in %s keeping the wall clock, seconds included", (start, ymd, zone, moved) => {
    expect(move(start, ymd, zone)).toEqual({ start: moved });
  });

  it("moves forward when the wall-clock time does not exist on the day picked", () => {
    expect(move("2026-03-07T07:30:00.000Z", "2026-03-08", NY)).toEqual({ start: "2026-03-08T07:30:00.000Z" });
  });

  const range = (current: DateCell, endpoint: "start" | "end", ymd: string, kind: DateKind = "date") =>
    pickDay({ current, kind, endpoint, withEnd: true, ymd, zone: NY });

  it("edits one end of a date range at a time", () => {
    expect(range({ start: "2026-11-12" }, "end", "2026-11-15")).toEqual({ start: "2026-11-12", end: "2026-11-15" });
    expect(range({ start: "2026-11-12" }, "end", "2026-11-12")).toEqual({ start: "2026-11-12" });
    expect(range({ start: "2026-11-12" }, "end", "2026-11-10")).toEqual({ start: "2026-11-10", end: "2026-11-12" });
    expect(range({ start: "2026-11-12", end: "2026-11-15" }, "start", "2026-11-13")).toEqual({
      start: "2026-11-13",
      end: "2026-11-15",
    });
    expect(range({ start: "2026-11-12", end: "2026-11-15" }, "start", "2026-11-20")).toEqual({ start: "2026-11-20" });
    expect(range({ start: "2026-11-12", end: "2026-11-15" }, "end", "2026-11-12")).toEqual({ start: "2026-11-12" });
  });

  it("moves the end of a date-time range to another day at the same wall-clock time", () => {
    expect(
      range({ start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T15:00:00.000Z" }, "end", "2026-11-13", "datetime"),
    ).toEqual({ start: "2026-11-12T14:00:00.000Z", end: "2026-11-13T15:00:00.000Z" });
  });

  it("drops the end when no end is wanted", () => {
    expect(
      pickDay({
        current: { start: "2026-11-12", end: "2026-11-15" },
        kind: "date",
        endpoint: "start",
        withEnd: false,
        ymd: "2026-11-13",
        zone: NY,
      }),
    ).toEqual({ start: "2026-11-13" });
  });
});

describe("setTimeOfDay", () => {
  const set = (current: DateCell, endpoint: "start" | "end", hour: number, minute: number, zone = NY) =>
    setTimeOfDay({ current, endpoint, hour, minute, zone });

  it("moves the start and shifts the end by the same elapsed time", () => {
    expect(set({ start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T15:00:00.000Z" }, "start", 11, 30)).toEqual({
      start: "2026-11-12T16:30:00.000Z",
      end: "2026-11-12T17:30:00.000Z",
    });
  });

  it("keeps the seconds and milliseconds the field does not show", () => {
    expect(set({ start: "2026-11-12T15:04:45.250Z" }, "start", 11, 30)).toEqual({ start: "2026-11-12T16:30:45.250Z" });
  });

  it.each([
    ["2026-11-01T06:30:00.000Z", 1, 30, NY],
    ["2026-10-25T01:30:00.000Z", 2, 30, BERLIN],
  ])("returns the same value when the time of %s is committed unchanged", (start, hour, minute, zone) => {
    const current = { start };
    expect(set(current, "start", hour, minute, zone)).toBe(current);
  });

  it.each([
    ["a time in the missing hour moves forward", "2026-03-08T14:00:00.000Z", 2, 30, NY, "2026-03-08T07:30:00.000Z"],
    ["a time in the missing hour moves forward", "2026-03-29T12:00:00.000Z", 2, 30, BERLIN, "2026-03-29T01:30:00.000Z"],
    ["a time in the repeated hour is its first occurrence", "2026-11-01T14:00:00.000Z", 1, 30, NY, "2026-11-01T05:30:00.000Z"],
    ["a time in the repeated hour is its first occurrence", "2026-10-25T12:00:00.000Z", 2, 30, BERLIN, "2026-10-25T00:30:00.000Z"],
  ])("%s (%s set to %i:%i in %s)", (_name, start, hour, minute, zone, moved) => {
    expect(set({ start }, "start", hour, minute, zone)).toEqual({ start: moved });
  });

  it("sets the end, and drops it when it would not be after the start", () => {
    const current = { start: "2026-11-12T14:00:00.000Z", end: "2026-11-12T15:00:00.000Z" };
    expect(set(current, "end", 12, 15)).toEqual({ start: current.start, end: "2026-11-12T17:15:00.000Z" });
    expect(set(current, "end", 8, 0)).toEqual({ start: current.start });
    expect(set({ start: current.start }, "end", 10, 30)).toEqual({ start: current.start, end: "2026-11-12T15:30:00.000Z" });
  });
});
