import { formatDistanceStrict } from "date-fns";
import { format, isToday, isYesterday } from "date-fns";

export function timeAgo(date: Date) {
  return formatDistanceStrict(new Date(date), new Date(), { addSuffix: true });
}

export function formattedDate(date: Date) {
  if (isToday(date)) {
    return `Today, ${format(date, "h:mma")}`;
  } else if (isYesterday(date)) {
    return `Yesterday, ${format(date, "h:mma")}`;
  } else {
    return format(date, "MMM dd, yyyy, h:mma");
  }
}
