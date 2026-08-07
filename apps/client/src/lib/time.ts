import { formatDistanceStrict, isToday, isYesterday } from "date-fns";
import i18n from "@/i18n.ts";
import { formatLocalized, getDateFnsLocale } from "@/lib/date-locale.ts";

export function timeAgo(date: Date) {
  return formatDistanceStrict(new Date(date), new Date(), {
    addSuffix: true,
    locale: getDateFnsLocale(),
  });
}

export function formattedDate(date: Date) {
  const locale = getDateFnsLocale();
  if (isToday(date)) {
    return i18n.t("Today, {{time}}", {
      time: formatLocalized(date, "h:mma", "p", locale),
    });
  } else if (isYesterday(date)) {
    return i18n.t("Yesterday, {{time}}", {
      time: formatLocalized(date, "h:mma", "p", locale),
    });
  } else {
    return formatLocalized(date, "MMM dd, yyyy, h:mma", "PPp", locale);
  }
}
