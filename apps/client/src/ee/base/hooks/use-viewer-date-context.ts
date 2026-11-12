import { useDatesContext } from "@mantine/dates";
import { useMemo, useSyncExternalStore } from "react";
import {
  getViewerClock,
  subscribeViewerClock,
} from "@/ee/base/utils/viewer-clock";

export type ViewerDateContext = {
  timeZone: string;
  weekStart: number;
  today: string;
};

export function useViewerDateContext(): ViewerDateContext {
  const clock = useSyncExternalStore(subscribeViewerClock, getViewerClock);
  const weekStart = useDatesContext().getFirstDayOfWeek();
  return useMemo(
    () => ({ timeZone: clock.timeZone, weekStart, today: clock.today }),
    [clock, weekStart],
  );
}
