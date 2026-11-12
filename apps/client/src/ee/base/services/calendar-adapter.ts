import type { ScheduleEventData } from "@mantine/schedule";
import {
  INVALID_DATE,
  addDays,
  addMonths,
  addToInstant,
  dateKindOfProperty,
  diffDays,
  instantToWall,
  isYmd,
  normalizeDateCell,
  startOfMonth,
  startOfWeek,
  wallToInstant,
  weekday,
  type DateCell,
  type DateKind,
} from "@docmost/base-formula/client";
import type {
  BasePropertyType,
  CalendarLayout,
  IBaseProperty,
  IBaseRow,
} from "@/ee/base/types/base.types";
import {
  isPropertyConverting,
  systemAccessorFor,
} from "@/ee/base/property-types/property-type.registry";
import { pickDay } from "@/ee/base/components/date-picker/date-edit";
import { MIN_PICKER_DATE, dateCellsEqual, readDateCell } from "@/ee/base/utils/date-cell";
import { fromWallString, toWallString } from "@/ee/base/utils/wall-clock";

export type CalendarWindowLayout = CalendarLayout | "mobile";

export type CalendarWindow = { from: string; to: string };

export type CalendarDayRange = [string, string];

export type CalendarResizeEdge = "start" | "end";

export type CalendarEventPayload = {
  rowId: string;
  kind: DateKind;
  value: DateCell;
  readOnly: boolean;
};

export type CalendarEvent = ScheduleEventData<CalendarEventPayload> & {
  id: string;
  start: string;
  end: string;
  payload: CalendarEventPayload;
};

const CALENDAR_DATE_SOURCE_TYPES: ReadonlySet<string> = new Set<BasePropertyType>([
  "date",
  "createdAt",
  "lastEditedAt",
]);

const LAST_CALENDAR_DATE = "9998-12-31";

export const WEEK_SLOT_MINUTES = 60;
export const TIME_SNAP_MINUTES = 15;

const MINUTES_PER_DAY = 1440;
const LAST_WEEK_START_MINUTE = MINUTES_PER_DAY - 2;

const pad = (n: number) => String(n).padStart(2, "0");

export function isCalendarDateSourceType(type: string): boolean {
  return CALENDAR_DATE_SOURCE_TYPES.has(type);
}

export function getCalendarDateProperties(properties: IBaseProperty[]): IBaseProperty[] {
  return properties.filter((p) => isCalendarDateSourceType(p.type));
}

export function isEditableCalendarSource(property: IBaseProperty): boolean {
  return property.type === "date" && !isPropertyConverting(property);
}

export function isCalendarDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    isYmd(value) &&
    value >= MIN_PICKER_DATE &&
    value <= LAST_CALENDAR_DATE
  );
}

export function shiftCalendarDate(date: string, unit: "month" | "week", step: 1 | -1): string {
  const next = unit === "month" ? startOfMonth(addMonths(date, step)) : addDays(date, 7 * step);
  return isCalendarDate(next) ? next : date;
}

export function getCalendarWindow(
  layout: CalendarWindowLayout,
  date: string,
  weekStart: number,
  showWeekends: boolean,
): CalendarWindow {
  if (layout === "week") {
    const first = startOfWeek(date, weekStart);
    const days = Array.from({ length: 7 }, (_, i) => addDays(first, i)).filter(
      (day) => showWeekends || (weekday(day) !== 0 && weekday(day) !== 6),
    );
    return { from: days[0], to: days[days.length - 1] };
  }
  if (layout === "month") {
    const from = startOfWeek(startOfMonth(date), weekStart);
    return { from, to: addDays(from, 41) };
  }
  const from = startOfMonth(date);
  return { from, to: addDays(addMonths(from, 1), -1) };
}

function toDisplaySpan(value: DateCell, kind: DateKind, timeZone: string): [string, string] {
  if (kind === "date") {
    return [`${value.start} 00:00:00`, `${value.end ?? value.start} 23:59:59`];
  }
  const start = toWallString(value.start, timeZone);
  const end = value.end ? toWallString(value.end, timeZone) : null;
  if (end && end > start) return [start, end];
  const day = start.slice(0, 10);
  const hour = Number(start.slice(11, 13));
  return [start, hour === 23 ? `${day} 23:59:59` : `${day} ${pad(hour + 1)}${start.slice(13)}`];
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.end !== b.end) return a.end > b.end ? -1 : 1;
  return 0;
}

export function toCalendarEvents(
  rows: IBaseRow[],
  options: {
    property: IBaseProperty;
    primaryPropertyId: string | undefined;
    window: CalendarWindow;
    timeZone: string;
    untitledLabel: string;
  },
): CalendarEvent[] {
  const { property, primaryPropertyId, window, timeZone, untitledLabel } = options;
  const kind = dateKindOfProperty(property.type, property.typeOptions);
  if (!kind || !isCalendarDateSourceType(property.type)) return [];
  const readOnly = !isEditableCalendarSource(property);
  const accessor = property.type === "date" ? null : systemAccessorFor(property.type);

  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const raw = accessor ? accessor(row) : row.cells[property.id];
    const value = readDateCell(raw, kind);
    if (!value) continue;

    let span: [string, string];
    try {
      span = toDisplaySpan(value, kind, timeZone);
    } catch (err) {
      if (err instanceof RangeError) continue;
      throw err;
    }
    const [start, end] = span;
    if (end.slice(0, 10) < window.from || start.slice(0, 10) > window.to) continue;

    const title = primaryPropertyId ? row.cells[primaryPropertyId] : undefined;
    events.push({
      id: row.id,
      title: typeof title === "string" && title.trim() ? title : untitledLabel,
      start,
      end,
      color: "blue",
      payload: { rowId: row.id, kind, value, readOnly },
    });
  }
  return events.sort(compareEvents);
}

export function eventDayRange(event: Pick<CalendarEvent, "start" | "end">): CalendarDayRange {
  const first = event.start.slice(0, 10);
  const endDay = event.end.slice(0, 10);
  const last = event.end.slice(11) === "00:00:00" && endDay > first ? addDays(endDay, -1) : endDay;
  return [first, last];
}

export function isAllDayLane(event: Pick<CalendarEvent, "start" | "end">): boolean {
  const first = event.start.slice(0, 10);
  const endDay = event.end.slice(0, 10);
  const endTime = event.end.slice(11);
  const lastDay = endTime.startsWith("00:00") ? addDays(endDay, -1) : endDay;
  if (lastDay > first) return true;
  if (event.start.slice(11) !== "00:00:00") return false;
  return (
    (endDay === first && endTime === "23:59:59") ||
    (endTime === "00:00:00" && diffDays(first, endDay) === 1)
  );
}

function plusMs(instant: string, ms: number): string {
  return new Date(Date.parse(instant) + ms).toISOString();
}

function elapsedMs(value: DateCell): number {
  return value.end ? Date.parse(value.end) - Date.parse(value.start) : 0;
}

function withEndAfter(start: string, end: string | undefined): DateCell {
  return end && end > start ? { start, end } : { start };
}

function toWrite(payload: CalendarEventPayload, edit: () => DateCell | null): DateCell | null {
  if (payload.readOnly) return null;
  let next: DateCell | null;
  try {
    next = edit();
  } catch (err) {
    if (err instanceof RangeError) return null;
    throw err;
  }
  if (!next) return null;
  const cell = normalizeDateCell(next, payload.kind);
  if (cell === INVALID_DATE || !cell || dateCellsEqual(cell, payload.value)) return null;
  return cell;
}

function moveByDays(payload: CalendarEventPayload, n: number, timeZone: string): DateCell | null {
  if (n === 0) return null;
  const { kind, value } = payload;
  if (kind === "date") {
    return value.end
      ? { start: addDays(value.start, n), end: addDays(value.end, n) }
      : { start: addDays(value.start, n) };
  }
  const start = addToInstant(value.start, n, "days", timeZone);
  if (!value.end) return { start };
  const end = addToInstant(value.end, n, "days", timeZone);
  return { start, end: end > start ? end : plusMs(start, elapsedMs(value)) };
}

const minuteOfDay = (s: string) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));

export function slotTimeAt(day: string, slotTime: string, fraction: number): string {
  const minutes = Math.min(
    Math.max(Math.round(minuteOfDay(`${day} ${slotTime}`) + fraction * WEEK_SLOT_MINUTES), 0),
    LAST_WEEK_START_MINUTE,
  );
  return `${day} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
}

export function dropOnMonth(
  event: CalendarEvent,
  newStart: string,
  grabbedDay: string | null,
  timeZone: string,
): DateCell | null {
  return toWrite(event.payload, () =>
    moveByDays(
      event.payload,
      diffDays(grabbedDay ?? event.start.slice(0, 10), newStart.slice(0, 10)),
      timeZone,
    ),
  );
}

export function dropOnWeek(
  event: CalendarEvent,
  newStart: string,
  grab: { day: string | null; time: string | null },
  timeZone: string,
): DateCell | null {
  const { payload } = event;
  return toWrite(payload, () => {
    const dropDay = newStart.slice(0, 10);
    if (payload.kind === "date" || isAllDayLane(event)) {
      return moveByDays(payload, diffDays(grab.day ?? event.start.slice(0, 10), dropDay), timeZone);
    }

    const from = grab.time ?? event.start;
    const offset =
      diffDays(from.slice(0, 10), dropDay) * MINUTES_PER_DAY + minuteOfDay(newStart) - minuteOfDay(from);
    const delta = Math.round(offset / TIME_SNAP_MINUTES) * TIME_SNAP_MINUTES;
    if (delta === 0) return null;

    const wall = instantToWall(payload.value.start, timeZone);
    const total = wall.hour * 60 + wall.minute + delta;
    const dayShift = Math.floor(total / MINUTES_PER_DAY);
    const movedDay = addDays(wall.ymd, dayShift);
    let minutes = total - dayShift * MINUTES_PER_DAY;
    if (movedDay < dropDay) minutes = 0;
    else if (movedDay > dropDay) minutes = LAST_WEEK_START_MINUTE;
    else minutes = Math.min(minutes, LAST_WEEK_START_MINUTE);

    const start = wallToInstant(
      { ...wall, ymd: dropDay, hour: Math.floor(minutes / 60), minute: minutes % 60 },
      timeZone,
    );
    return payload.value.end ? { start, end: plusMs(start, elapsedMs(payload.value)) } : { start };
  });
}

export function isStaleCalendarEvent(event: Pick<CalendarEvent, "payload">, kind: DateKind): boolean {
  return event.payload.kind !== kind;
}

export function resizeDayRange(
  range: CalendarDayRange,
  edge: CalendarResizeEdge,
  day: string,
): CalendarDayRange {
  if (edge === "start") return [day < range[1] ? day : range[1], range[1]];
  return [range[0], day > range[0] ? day : range[0]];
}

export function resizeOnMonth(
  event: CalendarEvent,
  edge: CalendarResizeEdge,
  toDay: string,
  timeZone: string,
): DateCell | null {
  const { kind, value } = event.payload;
  return toWrite(event.payload, () => {
    const [first, last] = eventDayRange(event);
    const n =
      edge === "start"
        ? diffDays(first, toDay < last ? toDay : last)
        : diffDays(last, toDay > first ? toDay : first);
    if (n === 0) return null;
    const move = (part: string) =>
      kind === "date" ? addDays(part, n) : addToInstant(part, n, "days", timeZone);
    const end = value.end ?? (kind === "date" ? value.start : fromWallString(event.end, timeZone));
    return edge === "start"
      ? withEndAfter(move(value.start), end)
      : withEndAfter(value.start, move(end));
  });
}

export function resizeOnWeek(
  event: CalendarEvent,
  newStart: string,
  newEnd: string,
  timeZone: string,
): DateCell | null {
  const { kind, value } = event.payload;
  return toWrite(event.payload, () => {
    if (kind === "date") return null;
    if (newStart === event.start && newEnd === event.end) return null;
    if (newStart !== event.start) {
      return withEndAfter(
        fromWallString(newStart, timeZone),
        value.end ?? fromWallString(event.end, timeZone),
      );
    }
    return withEndAfter(value.start, fromWallString(newEnd, timeZone));
  });
}

export function createOnDays(
  kind: DateKind,
  rangeStart: string,
  rangeEnd: string,
  timeZone: string,
): DateCell | null {
  const [first, last] = [rangeStart.slice(0, 10), rangeEnd.slice(0, 10)].sort();
  try {
    const start = pickDay({ current: null, kind, endpoint: "start", withEnd: false, ymd: first, zone: timeZone });
    if (first === last) return start;
    return pickDay({ current: start, kind, endpoint: "end", withEnd: true, ymd: last, zone: timeZone });
  } catch (err) {
    if (err instanceof RangeError) return null;
    throw err;
  }
}

export function createOnSlots(
  kind: DateKind,
  rangeStart: string,
  rangeEnd: string,
  timeZone: string,
): DateCell | null {
  const [first, last] = [rangeStart, rangeEnd].sort();
  if (kind === "date") return createOnDays(kind, first, last, timeZone);
  try {
    return withEndAfter(fromWallString(first, timeZone), fromWallString(last, timeZone));
  } catch (err) {
    if (err instanceof RangeError) return null;
    throw err;
  }
}
