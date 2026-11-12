import { addDays, addMonths, addYears } from './calendar';
import {
  formatInstant,
  formatYmd,
  readInstant,
  readYmd,
  utcMs,
} from './grammar';

export type CalendarUnit = 'days' | 'weeks' | 'months' | 'years';
export type ClockUnit = 'hours' | 'minutes';
export type WallClock = {
  ymd: string;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const FORMATTER_CACHE_LIMIT = 64;
const DAY_MS = 86_400_000;
const MAX_ZONE_LENGTH = 64;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  const cached = formatters.get(zone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    era: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  if (formatters.size >= FORMATTER_CACHE_LIMIT) {
    formatters.delete(formatters.keys().next().value as string);
  }
  formatters.set(zone, formatter);
  return formatter;
}

export function isValidTimeZone(zone: unknown): zone is string {
  if (
    typeof zone !== 'string' ||
    zone.length === 0 ||
    zone.length > MAX_ZONE_LENGTH
  ) {
    return false;
  }
  try {
    formatterFor(zone);
    return true;
  } catch {
    return false;
  }
}

type Fields = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function fieldsAt(ms: number, zone: string): Fields {
  const fields = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: ((ms % 1000) + 1000) % 1000,
  };
  let era = 'AD';
  for (const part of formatterFor(zone).formatToParts(ms)) {
    if (part.type === 'era') era = part.value;
    else if (part.type in fields) {
      fields[part.type as keyof Fields] = Number(part.value);
    }
  }
  if (era === 'BC') fields.year = 1 - fields.year;
  return fields;
}

function wallAsUtc(f: Fields): number {
  return utcMs(
    f.year,
    f.month,
    f.day,
    f.hour,
    f.minute,
    f.second,
    f.millisecond,
  );
}

function offsetMs(ms: number, zone: string): number {
  return wallAsUtc(fieldsAt(ms, zone)) - ms;
}

function localToInstantMs(local: number, zone: string): number {
  const before = offsetMs(local - DAY_MS, zone);
  const after = offsetMs(local + DAY_MS, zone);
  const early = local - before;
  if (before === after) return early;
  const late = local - after;
  const earlyFits = offsetMs(early, zone) === before;
  const lateFits = offsetMs(late, zone) === after;
  if (earlyFits && lateFits) return Math.min(early, late);
  if (lateFits) return late;
  return early;
}

function requireInteger(n: number, what: string): void {
  if (!Number.isInteger(n)) {
    throw new RangeError(`${what} must be an integer: ${String(n)}`);
  }
}

function requireClockField(
  value: number,
  max: number,
  what: string,
): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${what} out of range: ${String(value)}`);
  }
}

export function instantToWall(instant: string, zone: string): WallClock {
  const f = fieldsAt(readInstant(instant), zone);
  return {
    ymd: formatYmd(f.year, f.month, f.day),
    hour: f.hour,
    minute: f.minute,
    second: f.second,
    millisecond: f.millisecond,
  };
}

export function wallToInstant(wall: WallClock, zone: string): string {
  const { year, month, day } = readYmd(wall.ymd);
  requireClockField(wall.hour, 23, 'Hour');
  requireClockField(wall.minute, 59, 'Minute');
  requireClockField(wall.second, 59, 'Second');
  requireClockField(wall.millisecond, 999, 'Millisecond');
  const local = utcMs(
    year,
    month,
    day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond,
  );
  return formatInstant(localToInstantMs(local, zone));
}

export function startOfDay(ymd: string, zone: string): string {
  return wallToInstant(
    { ymd, hour: 0, minute: 0, second: 0, millisecond: 0 },
    zone,
  );
}

export function instantToYmd(instant: string, zone: string): string {
  return instantToWall(instant, zone).ymd;
}

export function todayIn(zone: string, now: Date): string {
  const ms = now instanceof Date ? now.getTime() : NaN;
  if (Number.isNaN(ms)) throw new RangeError('Invalid date');
  const f = fieldsAt(ms, zone);
  return formatYmd(f.year, f.month, f.day);
}

export function addToInstant(
  instant: string,
  n: number,
  unit: CalendarUnit | ClockUnit,
  zone: string,
): string {
  const ms = readInstant(instant);
  requireInteger(n, 'Amount');
  if (unit === 'hours') return formatInstant(ms + n * 3_600_000);
  if (unit === 'minutes') return formatInstant(ms + n * 60_000);
  if (
    unit !== 'days' &&
    unit !== 'weeks' &&
    unit !== 'months' &&
    unit !== 'years'
  ) {
    throw new RangeError(`Unknown unit: ${String(unit)}`);
  }
  if (n === 0) {
    fieldsAt(ms, zone);
    return instant;
  }
  const wall = instantToWall(instant, zone);
  const ymd =
    unit === 'days'
      ? addDays(wall.ymd, n)
      : unit === 'weeks'
        ? addDays(wall.ymd, 7 * n)
        : unit === 'months'
          ? addMonths(wall.ymd, n)
          : addYears(wall.ymd, n);
  return wallToInstant({ ...wall, ymd }, zone);
}
