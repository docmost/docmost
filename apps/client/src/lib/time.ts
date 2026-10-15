import { formatDistanceStrict, isToday, isYesterday } from "date-fns";
import i18n from "@/i18n.ts";
import { formatLocalized, getDateFnsLocale } from "@/lib/date-locale.ts";

export function timeAgo(date: Date) {
  return formatDistanceStrict(new Date(date), new Date(), {
    addSuffix: true,
    locale: getDateFnsLocale(),
  });
}

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function shortTimeAgo(date: Date) {
  const seconds = (Date.now() - new Date(date).getTime()) / 1000;
  const unit = RELATIVE_TIME_UNITS.find(([, unitSeconds]) => seconds >= unitSeconds);

  if (!unit) {
    return new Intl.RelativeTimeFormat(i18n.language, {
      numeric: "auto",
    }).format(0, "second");
  }

  const [name, unitSeconds] = unit;
  return new Intl.RelativeTimeFormat(i18n.language, {
    style: "narrow",
  }).format(-Math.floor(seconds / unitSeconds), name);
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
