import type {
  DateFilterAnchor,
  DateFilterRange,
} from "@/ee/base/types/base.types";

export const DATE_ANCHOR_PRESETS: { value: DateFilterAnchor; labelKey: string }[] =
  [
    { value: "today", labelKey: "Today" },
    { value: "tomorrow", labelKey: "Tomorrow" },
    { value: "yesterday", labelKey: "Yesterday" },
    { value: "oneWeekAgo", labelKey: "One week ago" },
    { value: "oneWeekFromNow", labelKey: "One week from now" },
    { value: "oneMonthAgo", labelKey: "One month ago" },
    { value: "oneMonthFromNow", labelKey: "One month from now" },
  ];

export const DATE_RANGE_PRESETS: { value: DateFilterRange; labelKey: string }[] =
  [
    { value: "pastWeek", labelKey: "Past week" },
    { value: "pastMonth", labelKey: "Past month" },
    { value: "pastYear", labelKey: "Past year" },
    { value: "thisWeek", labelKey: "This week" },
    { value: "thisMonth", labelKey: "This month" },
    { value: "thisYear", labelKey: "This year" },
    { value: "nextWeek", labelKey: "Next week" },
    { value: "nextMonth", labelKey: "Next month" },
    { value: "nextYear", labelKey: "Next year" },
  ];

export const ANCHOR_VALUES = new Set<string>(
  DATE_ANCHOR_PRESETS.map((p) => p.value),
);
export const RANGE_VALUES = new Set<string>(
  DATE_RANGE_PRESETS.map((p) => p.value),
);
