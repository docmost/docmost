import { useMemo } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { ActionIcon, Button, Loader, SegmentedControl, Tooltip } from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { CalendarLayout } from "@/ee/base/types/base.types";
import type { CalendarWindow } from "@/ee/base/services/calendar-window";
import { CALENDAR_ROW_CAP } from "@/ee/base/queries/calendar-rows-query";
import classes from "@/ee/base/styles/calendar.module.css";

type CalendarHeaderProps = {
  unit: "month" | "week";
  date: string;
  calendarWindow: CalendarWindow;
  layout: CalendarLayout;
  withLayoutSwitch: boolean;
  isLoading: boolean;
  isCapped: boolean;
  hasLoadError: boolean;
  onRetry: () => void;
  onLayoutChange: (layout: CalendarLayout) => void;
  onNavigate: (step: 1 | -1) => void;
  onToday: () => void;
};

const toUtcDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export function CalendarHeader({
  unit,
  date,
  calendarWindow,
  layout,
  withLayoutSwitch,
  isLoading,
  isCapped,
  hasLoadError,
  onRetry,
  onLayoutChange,
  onNavigate,
  onToday,
}: CalendarHeaderProps) {
  const { t, i18n } = useTranslation();

  const title = useMemo(() => {
    if (unit === "month") {
      return new Intl.DateTimeFormat(i18n.language, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(toUtcDate(date));
    }
    return new Intl.DateTimeFormat(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).formatRange(toUtcDate(calendarWindow.from), toUtcDate(calendarWindow.to));
  }, [unit, date, calendarWindow.from, calendarWindow.to, i18n.language]);

  const previousLabel = unit === "month" ? t("Previous month") : t("Previous week");
  const nextLabel = unit === "month" ? t("Next month") : t("Next week");

  return (
    <>
      <div className={classes.headerStart}>
        <div className={classes.title} aria-live="polite">
          {title}
        </div>
        <span className={classes.loaderSlot}>{isLoading && <Loader size="xs" />}</span>
        {hasLoadError && (
          <span className={clsx(classes.notice, classes.loadErrorNotice)} role="status">
            <IconAlertCircle size={14} aria-hidden />
            {t("Some events couldn't be loaded")}
            <Button variant="subtle" color="red" size="compact-xs" onClick={onRetry}>
              {t("Try again")}
            </Button>
          </span>
        )}
        {isCapped && (
          <span className={clsx(classes.notice, classes.capNotice)}>
            <IconAlertTriangle size={14} aria-hidden />
            {t("Showing the first {{limit}} events in this range", {
              limit: CALENDAR_ROW_CAP.toLocaleString(i18n.language),
            })}
          </span>
        )}
      </div>
      <div className={classes.headerEnd}>
        {withLayoutSwitch && (
          <SegmentedControl
            size="xs"
            value={layout}
            onChange={(value) => onLayoutChange(value as CalendarLayout)}
            data={[
              { value: "month", label: t("Month") },
              { value: "week", label: t("Week") },
            ]}
          />
        )}
        <div className={classes.navigation}>
          <Tooltip label={previousLabel} withinPortal>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={previousLabel}
              onClick={() => onNavigate(-1)}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Button variant="default" size="xs" onClick={onToday}>
            {t("Today")}
          </Button>
          <Tooltip label={nextLabel} withinPortal>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={nextLabel}
              onClick={() => onNavigate(1)}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
