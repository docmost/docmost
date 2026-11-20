import {
  isPlainObject,
  isYmd,
  requireWeekStart,
  toCanonicalInstant,
} from './grammar';
import {
  addDays,
  addMonths,
  addYears,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './calendar';
import { startOfDay } from './zone';

export type RelativeAnchor =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'oneWeekAgo'
  | 'oneWeekFromNow'
  | 'oneMonthAgo'
  | 'oneMonthFromNow';
export type RelativeRange =
  | 'pastWeek'
  | 'pastMonth'
  | 'pastYear'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'nextWeek'
  | 'nextMonth'
  | 'nextYear';
export type DateOperand =
  | { mode: 'exact'; date: string }
  | { mode: 'relative'; preset: RelativeAnchor }
  | { mode: 'range'; preset: RelativeRange };
export type DayBounds = { from: string; toExclusive: string };
export type InstantBounds = { from: string; toExclusive: string };

const ANCHORS: ReadonlySet<string> = new Set([
  'today',
  'tomorrow',
  'yesterday',
  'oneWeekAgo',
  'oneWeekFromNow',
  'oneMonthAgo',
  'oneMonthFromNow',
]);
const RANGES: ReadonlySet<string> = new Set([
  'pastWeek',
  'pastMonth',
  'pastYear',
  'thisWeek',
  'thisMonth',
  'thisYear',
  'nextWeek',
  'nextMonth',
  'nextYear',
]);

function oneDay(day: string): DayBounds {
  return { from: day, toExclusive: addDays(day, 1) };
}

function exactDay(date: unknown): string | null {
  if (typeof date !== 'string') return null;
  if (isYmd(date)) return date;
  const instant = toCanonicalInstant(date);
  return instant === null ? null : instant.slice(0, 10);
}

function relativeBounds(
  preset: RelativeAnchor,
  today: string,
): DayBounds {
  switch (preset) {
    case 'today':
      return oneDay(today);
    case 'tomorrow':
      return oneDay(addDays(today, 1));
    case 'yesterday':
      return oneDay(addDays(today, -1));
    case 'oneWeekAgo':
      return oneDay(addDays(today, -7));
    case 'oneWeekFromNow':
      return oneDay(addDays(today, 7));
    case 'oneMonthAgo':
      return oneDay(addMonths(today, -1));
    case 'oneMonthFromNow':
      return oneDay(addMonths(today, 1));
  }
}

function rangeBounds(
  preset: RelativeRange,
  today: string,
  weekStart: number,
): DayBounds {
  const tomorrow = addDays(today, 1);
  switch (preset) {
    case 'pastWeek':
      return { from: addDays(tomorrow, -7), toExclusive: tomorrow };
    case 'pastMonth':
      return { from: addMonths(tomorrow, -1), toExclusive: tomorrow };
    case 'pastYear':
      return { from: addYears(tomorrow, -1), toExclusive: tomorrow };
    case 'nextWeek':
      return { from: tomorrow, toExclusive: addDays(tomorrow, 7) };
    case 'nextMonth':
      return { from: tomorrow, toExclusive: addMonths(tomorrow, 1) };
    case 'nextYear':
      return { from: tomorrow, toExclusive: addYears(tomorrow, 1) };
    case 'thisWeek': {
      const from = startOfWeek(today, weekStart);
      return { from, toExclusive: addDays(from, 7) };
    }
    case 'thisMonth': {
      const from = startOfMonth(today);
      return { from, toExclusive: addMonths(from, 1) };
    }
    case 'thisYear': {
      const from = startOfYear(today);
      return { from, toExclusive: addYears(from, 1) };
    }
  }
}

export function resolveOperand(
  operand: unknown,
  today: string,
  weekStart: number,
): DayBounds | null {
  if (!isYmd(today)) {
    throw new RangeError('Today must be YYYY-MM-DD');
  }
  requireWeekStart(weekStart);
  if (!isPlainObject(operand)) return null;
  const { mode, preset, date } = operand;

  let bounds: DayBounds;
  try {
    if (mode === 'exact') {
      const day = exactDay(date);
      if (day === null) return null;
      bounds = oneDay(day);
    } else if (mode === 'relative') {
      if (typeof preset !== 'string' || !ANCHORS.has(preset)) return null;
      bounds = relativeBounds(preset as RelativeAnchor, today);
    } else if (mode === 'range') {
      if (typeof preset !== 'string' || !RANGES.has(preset)) return null;
      bounds = rangeBounds(preset as RelativeRange, today, weekStart);
    } else {
      return null;
    }
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
  return isYmd(bounds.from) && isYmd(bounds.toExclusive) ? bounds : null;
}

const MIN_INSTANT = '0001-01-01T00:00:00.000Z';

export function toInstantBounds(days: DayBounds, zone: string): InstantBounds {
  if (!isPlainObject(days)) throw new RangeError('Invalid day bounds');
  const from = startOfDay(days.from, zone);
  const toExclusive = startOfDay(days.toExclusive, zone);
  return {
    from: from < MIN_INSTANT ? MIN_INSTANT : from,
    toExclusive: toExclusive < MIN_INSTANT ? MIN_INSTANT : toExclusive,
  };
}
