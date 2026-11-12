import { Skeleton } from "@mantine/core";
import type { CalendarWindowLayout } from "@/ee/base/services/calendar-adapter";
import classes from "@/ee/base/styles/calendar-frame.module.css";

const DAYS_PER_WEEK = 7;
const EVENT_BARS = [0, 1, 0, 2, 0, 0, 1, 1, 0, 0, 2, 0, 1, 0, 0, 2, 1, 0, 0, 1, 0];

type CalendarSkeletonProps = {
  layout: CalendarWindowLayout;
};

export function CalendarSkeleton({ layout }: CalendarSkeletonProps) {
  const weekCount = layout === "week" ? 1 : 6;
  return (
    <div className={classes.skeleton} data-calendar-skeleton={layout} aria-hidden>
      <div className={classes.skeletonWeekdays}>
        {Array.from({ length: DAYS_PER_WEEK }, (_, i) => (
          <Skeleton key={i} height={10} width="40%" mx="auto" />
        ))}
      </div>
      <div className={classes.skeletonGrid}>
        {Array.from({ length: weekCount * DAYS_PER_WEEK }, (_, cell) => (
          <div key={cell} className={classes.skeletonDay}>
            <Skeleton height={10} width={18} />
            {Array.from({ length: EVENT_BARS[cell % EVENT_BARS.length] }, (_, bar) => (
              <Skeleton key={bar} height={14} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
