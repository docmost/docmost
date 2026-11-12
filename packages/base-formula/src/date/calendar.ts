import {
  DAY_MS,
  formatYmd,
  lastDayOfMonth,
  readYmd,
  requireInteger,
  requireWeekStart,
  utcMs,
} from './grammar';

export function addDays(ymd: string, n: number): string {
  const { year, month, day } = readYmd(ymd);
  requireInteger(n, 'Day count');
  const d = new Date(utcMs(year, month, day) + n * DAY_MS);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonths(ymd: string, n: number): string {
  const { year, month, day } = readYmd(ymd);
  requireInteger(n, 'Month count');
  const months = year * 12 + month - 1 + n;
  const targetYear = Math.floor(months / 12);
  const targetMonth = (months % 12 + 12) % 12 + 1;
  return formatYmd(
    targetYear,
    targetMonth,
    Math.min(day, lastDayOfMonth(targetYear, targetMonth)),
  );
}

export function addYears(ymd: string, n: number): string {
  requireInteger(n, 'Year count');
  return addMonths(ymd, 12 * n);
}

export function diffDays(a: string, b: string): number {
  const x = readYmd(a);
  const y = readYmd(b);
  return (
    (utcMs(y.year, y.month, y.day) - utcMs(x.year, x.month, x.day)) / DAY_MS
  );
}

export function weekday(ymd: string): number {
  const { year, month, day } = readYmd(ymd);
  return new Date(utcMs(year, month, day)).getUTCDay();
}

export function startOfWeek(ymd: string, weekStart: number): string {
  requireWeekStart(weekStart);
  return addDays(ymd, -((weekday(ymd) - weekStart + 7) % 7));
}

export function startOfMonth(ymd: string): string {
  const { year, month } = readYmd(ymd);
  return formatYmd(year, month, 1);
}

export function startOfYear(ymd: string): string {
  const { year } = readYmd(ymd);
  return formatYmd(year, 1, 1);
}
