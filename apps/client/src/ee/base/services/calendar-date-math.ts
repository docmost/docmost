import dayjs from "dayjs";
import {
  DateValue,
  isDateOnly,
  localPartsToInstant,
} from "@/ee/base/utils/date-value";

export type DateMove =
  | { fromDay: string; toDay: string }
  | { grabTime: string; dropTime: string };

export type DateResize =
  | { edge: "start" | "end"; start: string; end: string }
  | { edge: "start" | "end"; fromDay: string; toDay: string; displayEnd: string };

export type DayRange = [string, string];

export const TIME_SNAP_MINUTES = 15;

const DAY_MS = 86_400_000;
const MINUTES_PER_DAY = 1440;
const LAST_RANGE_START_MINUTE = MINUTES_PER_DAY - 2;
const LAST_POINT_START_MINUTE = MINUTES_PER_DAY - 1;

const pad = (n: number, length = 2) => String(n).padStart(length, "0");

function toEpochDay(ymd: string): number {
  const date = new Date(0);
  date.setUTCFullYear(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
  );
  return Math.round(date.getTime() / DAY_MS);
}

function epochDayToYmd(epochDay: number): string {
  const date = new Date(epochDay * DAY_MS);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(ymd: string, days: number): string {
  return epochDayToYmd(toEpochDay(ymd) + days);
}

function localToInstant(local: string): string {
  const [hours = 0, minutes = 0, seconds = 0] = local
    .slice(11)
    .split(":")
    .filter(Boolean)
    .map(Number);
  return localPartsToInstant(local.slice(0, 10), hours, minutes, seconds);
}

function toWallClockMinutes(local: string): number {
  return (
    toEpochDay(local) * MINUTES_PER_DAY +
    Number(local.slice(11, 13)) * 60 +
    Number(local.slice(14, 16))
  );
}

function wallClockToInstant(totalMinutes: number, seconds: number): string {
  const epochDay = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const minuteOfDay = totalMinutes - epochDay * MINUTES_PER_DAY;
  return localPartsToInstant(
    epochDayToYmd(epochDay),
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
    seconds,
  );
}

function shiftPart(part: string, days: number): string {
  return isDateOnly(part)
    ? addDays(part, days)
    : dayjs(part).add(days, "day").toISOString();
}

function isBefore(a: string, b: string): boolean {
  return isDateOnly(a) ? a < b : Date.parse(a) < Date.parse(b);
}

function distinctEnd(value: DateValue): string | undefined {
  return value.end && value.end !== value.start ? value.end : undefined;
}

function startKeepingDuration(value: DateValue, start: string): DateValue {
  if (!value.end) return { start };
  const duration = Date.parse(value.end) - Date.parse(value.start);
  return { start, end: new Date(Date.parse(start) + duration).toISOString() };
}

function shiftDays(value: DateValue, days: number): DateValue {
  if (days === 0) return value;
  const start = shiftPart(value.start, days);
  if (!value.end) return { start };
  const end = shiftPart(value.end, days);
  return isBefore(end, start) ? startKeepingDuration(value, start) : { start, end };
}

export function moveDateValue(value: DateValue, move: DateMove): DateValue {
  if ("fromDay" in move) {
    return shiftDays(value, toEpochDay(move.toDay) - toEpochDay(move.fromDay));
  }
  if (isDateOnly(value.start)) {
    return shiftDays(value, toEpochDay(move.dropTime) - toEpochDay(move.grabTime));
  }
  const offset = toWallClockMinutes(move.dropTime) - toWallClockMinutes(move.grabTime);
  const delta = Math.round(offset / TIME_SNAP_MINUTES) * TIME_SNAP_MINUTES;
  if (delta === 0) return value;
  const storedStart = dayjs(value.start).format("YYYY-MM-DD HH:mm:ss");
  const dropDayStart = toEpochDay(move.dropTime) * MINUTES_PER_DAY;
  const start = Math.min(
    Math.max(toWallClockMinutes(storedStart) + delta, dropDayStart),
    dropDayStart + (distinctEnd(value) ? LAST_RANGE_START_MINUTE : LAST_POINT_START_MINUTE),
  );
  const seconds = Number(storedStart.slice(17, 19));
  return startKeepingDuration(value, wallClockToInstant(start, seconds));
}

export function resizeDateValue(value: DateValue, resize: DateResize): DateValue {
  const { edge } = resize;
  const dateOnly = isDateOnly(value.start);
  const toPart = (local: string) =>
    dateOnly ? local.slice(0, 10) : localToInstant(local);
  const storedEnd = distinctEnd(value);
  let nextStart: string;
  let nextEnd: string;
  if ("fromDay" in resize) {
    const days = toEpochDay(resize.toDay) - toEpochDay(resize.fromDay);
    if (days === 0) return value;
    const end = storedEnd ?? (dateOnly ? value.start : toPart(resize.displayEnd));
    nextStart = edge === "start" ? shiftPart(value.start, days) : value.start;
    nextEnd = edge === "end" ? shiftPart(end, days) : end;
  } else {
    nextStart = edge === "start" ? toPart(resize.start) : value.start;
    nextEnd =
      edge === "end"
        ? toPart(resize.end)
        : storedEnd ?? (dateOnly ? value.start : toPart(resize.end));
  }
  if (isBefore(nextEnd, nextStart)) {
    if (edge === "start") nextStart = nextEnd;
    else nextEnd = nextStart;
  }
  const next = nextEnd === nextStart ? { start: nextStart } : { start: nextStart, end: nextEnd };
  return next.start === value.start && next.end === storedEnd ? value : next;
}

export function getMonthEventDayRange(start: string | Date, end: string | Date): DayRange {
  return [
    dayjs(start).format("YYYY-MM-DD"),
    dayjs(end).subtract(1, "second").format("YYYY-MM-DD"),
  ];
}

export function resizeDayRange(
  [firstDay, lastDay]: DayRange,
  edge: DateResize["edge"],
  day: string,
): DayRange {
  return edge === "start"
    ? [day < lastDay ? day : lastDay, lastDay]
    : [firstDay, day > firstDay ? day : firstDay];
}

export function slotSelectionToDateValue(
  rangeStart: string,
  rangeEnd: string,
  includeTime: boolean,
): DateValue {
  const [first, last] =
    rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
  const start = includeTime ? localToInstant(first) : first.slice(0, 10);
  const end = includeTime ? localToInstant(last) : last.slice(0, 10);
  return start === end ? { start } : { start, end };
}

export function dayToDateValue(day: string): DateValue {
  return { start: day.slice(0, 10) };
}
