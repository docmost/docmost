import { isThisYear, isToday, isYesterday } from "date-fns";
import i18n from "@/i18n.ts";
import { formatLocalized, getDateFnsLocale } from "@/lib/date-locale.ts";

export function formatLabelListDate(date: Date): string {
  const locale = getDateFnsLocale();
  if (isToday(date)) {
    return i18n.t("Today, {{time}}", {
      time: formatLocalized(date, "h:mma", "p", locale),
    });
  }
  if (isYesterday(date)) {
    return i18n.t("Yesterday, {{time}}", {
      time: formatLocalized(date, "h:mma", "p", locale),
    });
  }
  if (isThisYear(date)) {
    if (locale.code?.startsWith("en")) {
      return formatLocalized(date, "MMM dd", "MMM dd", locale);
    }
    return new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return formatLocalized(date, "MMM dd, yyyy", "PP", locale);
}
