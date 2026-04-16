import { addDays, addMonths, addWeeks, addYears } from 'date-fns';

export function calculateVerificationExpiry(opts: {
  mode?: string | null;
  periodAmount?: number | null;
  periodUnit?: string | null;
  fixedExpiresAt?: Date | null;
  baseDate?: Date;
}): Date | null {
  const mode = opts.mode ?? 'period';
  const baseDate = opts.baseDate ?? new Date();

  if (mode === 'indefinite') {
    return null;
  }

  if (mode === 'fixed') {
    return opts.fixedExpiresAt ?? null;
  }

  const periodAmount = Math.max(1, opts.periodAmount ?? 1);
  switch (opts.periodUnit ?? 'month') {
    case 'day':
      return addDays(baseDate, periodAmount);
    case 'week':
      return addWeeks(baseDate, periodAmount);
    case 'year':
      return addYears(baseDate, periodAmount);
    case 'month':
    default:
      return addMonths(baseDate, periodAmount);
  }
}

export function getExpiringVerificationStatus(
  expiresAt: Date | null,
  now: Date = new Date(),
): 'verified' | 'expiring' | 'expired' {
  if (!expiresAt) {
    return 'verified';
  }

  const timeUntilExpiry = expiresAt.getTime() - now.getTime();
  if (timeUntilExpiry <= 0) {
    return 'expired';
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (timeUntilExpiry <= sevenDaysMs) {
    return 'expiring';
  }

  return 'verified';
}
