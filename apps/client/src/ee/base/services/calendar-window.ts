import { getMonthRange, getWeekDays } from "@mantine/schedule";
import type { DayOfWeek } from "@mantine/schedule";
import type {
  CalendarLayout,
  FilterCondition,
  FilterGroup,
  FilterNode,
} from "@/ee/base/types/base.types";

export type CalendarWindowLayout = CalendarLayout | "mobile";

export type CalendarWindow = { from: string; to: string };

const WEEKEND_DAYS: DayOfWeek[] = [0, 6];

export function getCalendarWindow(
  layout: CalendarWindowLayout,
  date: string,
  firstDayOfWeek: DayOfWeek,
  showWeekends: boolean,
): CalendarWindow {
  if (layout === "week") {
    const days = getWeekDays({
      week: date,
      firstDayOfWeek,
      weekendDays: WEEKEND_DAYS,
      withWeekendDays: showWeekends,
    });
    return { from: days[0].slice(0, 10), to: days[days.length - 1].slice(0, 10) };
  }
  const range = getMonthRange({
    month: date,
    withOutsideDays: layout === "month",
    consistentWeeks: true,
    firstDayOfWeek,
  });
  return { from: range.start.slice(0, 10), to: range.end.slice(0, 10) };
}

export function buildCalendarFilter(
  active: FilterNode | undefined,
  datePropertyId: string,
  from: string,
  to: string,
): FilterGroup {
  const windowCondition: FilterCondition = {
    propertyId: datePropertyId,
    op: "isWithin",
    value: { mode: "exactRange", from, to },
  };
  if (!active || ("children" in active && active.children.length === 0)) {
    return { op: "and", children: [windowCondition] };
  }
  if ("children" in active && active.op === "and") {
    return { op: "and", children: [...active.children, windowCondition] };
  }
  return { op: "and", children: [active, windowCondition] };
}
