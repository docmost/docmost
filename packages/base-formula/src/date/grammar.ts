export type DateKind = 'date' | 'datetime';
export type DateCell = { start: string; end?: string };

export const INVALID_DATE: unique symbol = Symbol('INVALID_DATE');

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:\d{2})$/;
const EXACT_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const MAX_INSTANT_LENGTH = 40;
const MIN_YEAR = 0;
const MAX_YEAR = 9999;

export function utcMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, millisecond);
  return d.getTime();
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(utcMs(year, month + 1, 0)).getUTCDate();
}

function isRealDay(year: number, month: number, day: number): boolean {
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth(year, month)
  );
}

export function readYmd(s: string): {
  year: number;
  month: number;
  day: number;
} {
  const m = typeof s === 'string' ? YMD.exec(s) : null;
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year >= MIN_YEAR && year <= MAX_YEAR && isRealDay(year, month, day)) {
      return { year, month, day };
    }
  }
  throw new RangeError(`Invalid date: ${String(s)}`);
}

export function formatYmd(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`Year out of range: ${year}`);
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatInstant(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  if (Number.isNaN(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`Instant out of range: ${ms}`);
  }
  return d.toISOString();
}

export function readInstant(s: string): number {
  const m = typeof s === 'string' ? EXACT_INSTANT.exec(s) : null;
  if (m) {
    const [year, month, day, hour, minute, second, ms] = m
      .slice(1)
      .map(Number);
    if (
      isRealDay(year, month, day) &&
      hour <= 23 &&
      minute <= 59 &&
      second <= 59
    ) {
      return utcMs(year, month, day, hour, minute, second, ms);
    }
  }
  throw new RangeError(`Invalid instant: ${String(s)}`);
}

export function isYmd(s: string): boolean {
  if (typeof s !== 'string') return false;
  const m = YMD.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  return (
    year >= 1 && year <= MAX_YEAR && isRealDay(year, Number(m[2]), Number(m[3]))
  );
}

export function toCanonicalInstant(s: string): string | null {
  if (typeof s !== 'string' || s.length > MAX_INSTANT_LENGTH) return null;
  const m = INSTANT.exec(s);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const millisecond =
    m[7] === undefined ? 0 : Number(m[7].padEnd(3, '0').slice(0, 3));

  if (year < 1 || !isRealDay(year, month, day)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  let offsetMinutes = 0;
  if (m[8] !== 'Z') {
    const offsetHour = Number(m[8].slice(1, 3));
    const offsetMinute = Number(m[8].slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    const sign = m[8][0] === '-' ? -1 : 1;
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }

  const ms =
    utcMs(year, month, day, hour, minute, second, millisecond) -
    offsetMinutes * 60000;
  const resultYear = new Date(ms).getUTCFullYear();
  if (resultYear < 1 || resultYear > MAX_YEAR) return null;
  return new Date(ms).toISOString();
}

export function isCanonicalInstant(s: string): boolean {
  return typeof s === 'string' && toCanonicalInstant(s) === s;
}

export function partKind(s: string): DateKind | null {
  if (isYmd(s)) return 'date';
  if (isCanonicalInstant(s)) return 'datetime';
  return null;
}

const MIDNIGHT_INSTANT = /^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/;
const NO_ZONE_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/;

function toPart(value: unknown, kind: DateKind): string | null {
  if (typeof value !== 'string') return null;
  if (kind === 'date') return isYmd(value) ? value : null;
  return toCanonicalInstant(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function normalizeDateCell(
  input: unknown,
  kind: DateKind,
): DateCell | null | typeof INVALID_DATE {
  if (input === null) return null;

  if (typeof input === 'string') {
    const midnight = kind === 'date' ? MIDNIGHT_INSTANT.exec(input) : null;
    const start =
      midnight && isYmd(midnight[1]) ? midnight[1] : toPart(input, kind);
    return start === null ? INVALID_DATE : { start };
  }

  if (!isPlainObject(input)) return INVALID_DATE;
  if (Object.keys(input).some((key) => key !== 'start' && key !== 'end')) {
    return INVALID_DATE;
  }

  const start = toPart(input.start, kind);
  if (start === null) return INVALID_DATE;
  if (input.end === undefined || input.end === null) return { start };

  const end = toPart(input.end, kind);
  if (end === null || end < start) return INVALID_DATE;
  return end === start ? { start } : { start, end };
}

export function legacyDateCell(value: string, kind: DateKind): DateCell | null {
  if (typeof value !== 'string') return null;
  if (isYmd(value)) {
    return {
      start: kind === 'date' ? value : `${value}T00:00:00.000Z`,
    };
  }
  let canonical = toCanonicalInstant(value);
  if (canonical === null && NO_ZONE_INSTANT.test(value)) {
    canonical = toCanonicalInstant(`${value}Z`);
  }
  if (canonical === null) return null;
  return { start: kind === 'date' ? canonical.slice(0, 10) : canonical };
}
