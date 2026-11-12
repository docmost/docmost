import type { ScheduleEventData } from "@mantine/schedule";
import {
  addDays,
  addMonths,
  dateKindOfProperty,
  diffDays,
  isYmd,
  startOfMonth,
  startOfWeek,
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
import { MIN_PICKER_DATE, readDateCell } from "@/ee/base/utils/date-cell";
import { toWallString } from "@/ee/base/utils/wall-clock";

export type CalendarWindowLayout = CalendarLayout | "mobile";

export type CalendarWindow = { from: string; to: string };

export type CalendarDayRange = [string, string];

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
