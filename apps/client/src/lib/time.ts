import { formatDistanceStrict } from "date-fns";
import { format, isToday, isYesterday } from "date-fns";
import i18n from "@/i18n.ts";

export function timeAgo(date: Date) {
  return formatDistanceStrict(new Date(date), new Date(), { addSuffix: true });
}

export function formattedDate(date: Date) {
  if (isToday(date)) {
    return i18n.t("Today, {{time}}", { time: format(date, "h:mma") });
  } else if (isYesterday(date)) {
    return i18n.t("Yesterday, {{time}}", { time: format(date, "h:mma") });
  } else {
    return format(date, "MMM dd, yyyy, h:mma");
  }
}
