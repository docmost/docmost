import { differenceInCalendarDays } from "date-fns";

export function formatInterval(interval: string): string {
  if (interval === "month") {
    return "monthly";
  }
  if (interval === "year") {
    return "yearly";
  }
}

export function getTrialDaysLeft(trialEndAt: Date) {
  if (!trialEndAt) return null;

  const daysLeft = differenceInCalendarDays(trialEndAt, new Date());
  return daysLeft > 0 ? daysLeft : 0;
}
