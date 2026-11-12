import {
  instantToWall,
  wallToInstant,
  type DateCell,
  type DateKind,
} from "@docmost/base-formula/client";
import { partDayIn } from "@/ee/base/utils/date-cell";

export type DateEndpoint = "start" | "end";

const HOUR_MS = 3_600_000;

function moveToDay(part: string, kind: DateKind, ymd: string, zone: string): string {
  if (kind === "date") return ymd;
  if (partDayIn(part, zone) === ymd) return part;
  return wallToInstant({ ...instantToWall(part, zone), ymd }, zone);
}

export function pickDay(args: {
  current: DateCell | null;
  kind: DateKind;
  endpoint: DateEndpoint;
  withEnd: boolean;
  ymd: string;
  zone: string;
}): DateCell {
  const { current, kind, endpoint, withEnd, ymd, zone } = args;

  if (!current) {
    const start =
      kind === "date"
        ? ymd
        : wallToInstant({ ymd, hour: 9, minute: 0, second: 0, millisecond: 0 }, zone);
    if (withEnd && kind === "datetime") {
      return { start, end: new Date(Date.parse(start) + HOUR_MS).toISOString() };
    }
    return { start };
  }

  if (!withEnd) return { start: moveToDay(current.start, kind, ymd, zone) };

  const end0 = current.end ?? current.start;

  if (endpoint === "start") {
    const start = moveToDay(current.start, kind, ymd, zone);
    return end0 > start ? { start, end: end0 } : { start };
  }

  const startDay = partDayIn(current.start, zone);
  if (startDay !== null && ymd < startDay) {
    return { start: moveToDay(current.start, kind, ymd, zone), end: end0 };
  }
  const end = moveToDay(end0, kind, ymd, zone);
  return end > current.start ? { start: current.start, end } : { start: current.start };
}

export function setTimeOfDay(args: {
  current: DateCell;
  endpoint: DateEndpoint;
  hour: number;
  minute: number;
  zone: string;
}): DateCell {
  const { current, endpoint, hour, minute, zone } = args;
  const part = endpoint === "start" ? current.start : (current.end ?? current.start);
  const wall = instantToWall(part, zone);
  if (wall.hour === hour && wall.minute === minute) return current;

  const next = wallToInstant({ ...wall, hour, minute }, zone);

  if (endpoint === "start") {
    if (!current.end) return { start: next };
    const end = new Date(
      Date.parse(current.end) + Date.parse(next) - Date.parse(current.start),
    ).toISOString();
    return { start: next, end };
  }
  return next > current.start ? { start: current.start, end: next } : { start: current.start };
}
