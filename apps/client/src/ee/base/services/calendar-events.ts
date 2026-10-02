import type { ScheduleEventData } from "@mantine/schedule";
import type {
  BasePropertyType,
  IBaseProperty,
  IBaseRow,
} from "@/ee/base/types/base.types";
import type { CalendarWindow } from "@/ee/base/services/calendar-window";
import { systemAccessorFor } from "@/ee/base/property-types/property-type.registry";
import {
  DateValue,
  isDateOnly,
  localDateToYmd,
  parseDateValue,
} from "@/ee/base/utils/date-value";

const CALENDAR_DATE_SOURCE_TYPES: ReadonlySet<string> = new Set<BasePropertyType>([
  "date",
  "createdAt",
  "lastEditedAt",
]);

export function isCalendarDateSourceType(type: string): boolean {
  return CALENDAR_DATE_SOURCE_TYPES.has(type);
}

export function getCalendarDateProperties(properties: IBaseProperty[]): IBaseProperty[] {
  return properties.filter((p) => isCalendarDateSourceType(p.type));
}

export type CalendarEventPayload = { rowId: string; value: DateValue };

export type CalendarEvent = ScheduleEventData<CalendarEventPayload> & {
  start: string;
  end: string;
  payload: CalendarEventPayload;
};

type ToScheduleEventsOptions = {
  property: IBaseProperty;
  primaryPropertyId: string | undefined;
  window: CalendarWindow;
  untitledLabel: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalDateTime(instant: string): string {
  const date = new Date(instant);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${localDateToYmd(date)} ${time}`;
}

function toPointSpan(start: string): [string, string] {
  const day = start.slice(0, 10);
  const hour = Number(start.slice(11, 13));
  if (hour === 23) return [`${day} 23:00:00`, `${day} 23:59:00`];
  return [start, `${day} ${pad(hour + 1)}${start.slice(13)}`];
}

function toDisplaySpan(value: DateValue): [string, string] {
  if (isDateOnly(value.start)) {
    return [`${value.start} 00:00:00`, `${value.end ?? value.start} 23:59:59`];
  }
  const start = toLocalDateTime(value.start);
  const end = value.end ? toLocalDateTime(value.end) : null;
  return end && end > start ? [start, end] : toPointSpan(start);
}

function readDateValue(row: IBaseRow, property: IBaseProperty): DateValue | null {
  if (property.type === "date") return parseDateValue(row.cells[property.id]);
  const raw = systemAccessorFor(property.type)?.(row);
  const date = typeof raw === "string" ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime())
    ? { start: date.toISOString() }
    : null;
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.end !== b.end) return a.end > b.end ? -1 : 1;
  return 0;
}

export function toScheduleEvents(
  rows: IBaseRow[],
  { property, primaryPropertyId, window, untitledLabel }: ToScheduleEventsOptions,
): CalendarEvent[] {
  if (!isCalendarDateSourceType(property.type)) return [];
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const value = readDateValue(row, property);
    if (!value) continue;
    const [start, end] = toDisplaySpan(value);
    if (
      end < start ||
      start.slice(0, 10) > window.to ||
      end.slice(0, 10) < window.from
    ) {
      continue;
    }
    const title = primaryPropertyId ? row.cells[primaryPropertyId] : undefined;
    events.push({
      id: row.id,
      title: typeof title === "string" && title.trim() ? title : untitledLabel,
      start,
      end,
      color: "blue",
      payload: { rowId: row.id, value },
    });
  }
  return events.sort(compareEvents);
}
