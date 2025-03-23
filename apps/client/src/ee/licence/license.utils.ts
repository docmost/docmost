import { ILicenseInfo } from "@/ee/licence/types/license.types.ts";
import { differenceInDays, isAfter } from "date-fns";

export const GRACE_PERIOD_DAYS = 10;

export function isLicenseExpired(license: ILicenseInfo): boolean {
  return isAfter(new Date(), license.expiresAt);
}

export function daysToExpire(license: ILicenseInfo): number {
  const days = differenceInDays(license.expiresAt, new Date());
  return days > 0 ? days : 0;
}

export function isTrial(license: ILicenseInfo): boolean {
  return license.trial;
}

export function isValid(license: ILicenseInfo): boolean {
  return !isLicenseExpired(license);
}

export function hasExpiredGracePeriod(license: ILicenseInfo): boolean {
  if (!isLicenseExpired(license)) return false;
  return differenceInDays(new Date(), license.expiresAt) > GRACE_PERIOD_DAYS;
}
