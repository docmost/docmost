import { MouseEvent, memo, useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@mantine/hooks";
import { MobileMonthView, MonthView } from "@mantine/schedule";
import type {
  DayOfWeek,
  MonthViewProps,
  ScheduleEventData,
  ScheduleLabelsOverride,
} from "@mantine/schedule";
import type { CalendarEvent } from "@/ee/base/services/calendar-events";
import type { CalendarWindow } from "@/ee/base/services/calendar-window";
import {
  DateMove,
  DateResize,
  DayRange,
  dayToDateValue,
  getMonthEventDayRange,
  slotSelectionToDateValue,
} from "@/ee/base/services/calendar-date-math";
import type { DateValue } from "@/ee/base/utils/date-value";
import {
  CALENDAR_OVERLAY_Z_INDEX,
  CalendarEventDisplay,
  CalendarMobileEvent,
  CalendarMonthEvent,
  CalendarMonthEventBody,
  CalendarRenderEvent,
} from "@/ee/base/components/calendar/calendar-event";
import {
  getCalendarDateAt,
  useCalendarMonthResize,
} from "@/ee/base/components/calendar/use-calendar-month-resize";
import classes from "@/ee/base/styles/calendar.module.css";

const MONTH_WEEKDAYS_HEIGHT = 37;
const MONTH_WEEK_COUNT = 6;
const MONTH_DAY_CHROME_HEIGHT = 52;
const MONTH_EVENT_ROW_HEIGHT = 24;
const MONTH_MAX_EVENT_ROWS = 10;

type MonthEventDrop = Parameters<NonNullable<MonthViewProps["onEventDrop"]>>[0];

type CalendarMonthSharedProps = {
  date: string;
  events: CalendarEvent[];
  calendarWindow: CalendarWindow;
  firstDayOfWeek: DayOfWeek;
  labels: ScheduleLabelsOverride;
  display: CalendarEventDisplay;
  onEventClick: (event: ScheduleEventData) => void;
};

function getPointerType(event: MouseEvent<HTMLButtonElement>): string | undefined {
  return (event.nativeEvent as Partial<PointerEvent>).pointerType;
}

function isAddAffordanceHit(
  event: MouseEvent<HTMLButtonElement>,
  alwaysShown: boolean,
  pointerType: string | undefined,
): boolean {
  const day = event.currentTarget;
  if (!alwaysShown) {
    if (pointerType === "touch" || !day.matches(":hover, :focus-visible")) return false;
  }
  const label = day.firstElementChild;
  if (!label) return false;
  const dayRect = day.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  if (event.clientY < labelRect.top || event.clientY > labelRect.bottom) return false;
  if (getComputedStyle(day).direction === "rtl") {
    const inset = dayRect.right - labelRect.right;
    return event.clientX <= dayRect.left + inset + labelRect.width;
  }
  const inset = labelRect.left - dayRect.left;
  return event.clientX >= dayRect.right - inset - labelRect.width;
}

function useDayProps(
  events: CalendarEvent[],
  calendarWindow: CalendarWindow,
  createProps?: Record<string, unknown>,
  resizeRange?: DayRange | null,
) {
  const { t, i18n } = useTranslation();

  const eventCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const [startDay, endDay] = getMonthEventDayRange(event.start, event.end);
      const firstDay = startDay < calendarWindow.from ? calendarWindow.from : startDay;
      const lastDay = endDay < calendarWindow.to ? endDay : calendarWindow.to;
      for (
        let day = dayjs(firstDay);
        !day.isAfter(lastDay, "day");
        day = day.add(1, "day")
      ) {
        const key = day.format("YYYY-MM-DD");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [events, calendarWindow]);

  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "full", timeZone: "UTC" }),
    [i18n.language],
  );

  return useCallback(
    (day: string) => {
      const count = eventCountByDay.get(day) ?? 0;
      const label = dayFormat.format(new Date(`${day}T00:00:00Z`));
      return {
        "data-calendar-date": day,
        "aria-label": count > 0 ? `${label}, ${t("{{count}} events", { count })}` : label,
        ...createProps,
        mod: resizeRange && {
          "resize-preview": day >= resizeRange[0] && day <= resizeRange[1],
        },
      };
    },
    [eventCountByDay, dayFormat, t, createProps, resizeRange],
  );
}

type CalendarMonthProps = CalendarMonthSharedProps & {
  height: number;
  showWeekends: boolean;
  overlaysDisabled: boolean;
  onEventMove?: (eventId: string, move: DateMove) => void;
  onEventResize?: (eventId: string, resize: DateResize) => void;
  onCreate?: (value: DateValue) => void;
};

export const CalendarMonth = memo(function CalendarMonth({
  date,
  events,
  calendarWindow,
  height,
  firstDayOfWeek,
  showWeekends,
  overlaysDisabled,
  labels,
  display,
  onEventClick,
  onEventMove,
  onEventResize,
  onCreate,
}: CalendarMonthProps) {
  const { t } = useTranslation();
  const canHover = useMediaQuery("(hover: hover)", true);
  const alwaysShowAdd = useMediaQuery("(hover: none)", false, {
    getInitialValueInEffect: false,
  });
  const finePointer = useMediaQuery("(pointer: fine)", true, {
    getInitialValueInEffect: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const grabbedDayRef = useRef<string | null>(null);
  const lastClickPointerTypeRef = useRef<string | undefined>(undefined);
  const [isDraggingEvent, setIsDraggingEvent] = useState(false);
  const { resizeRange, isResizing, resizeIntentRef, wasResizing, startResize } =
    useCalendarMonthResize(rootRef, onEventResize);
  const canResize = !!onEventResize && finePointer;

  const handleDayDoubleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const day = event.currentTarget.dataset.calendarDate;
      if (day && !isAddAffordanceHit(event, alwaysShowAdd, lastClickPointerTypeRef.current)) {
        onCreate?.(dayToDateValue(day));
      }
    },
    [onCreate, alwaysShowAdd],
  );
  const createDayProps = useMemo(
    () =>
      onCreate
        ? {
            onDoubleClick: handleDayDoubleClick,
            "aria-description": t("Press Enter to create a record"),
          }
        : undefined,
    [onCreate, handleDayDoubleClick, t],
  );
  const getDayProps = useDayProps(events, calendarWindow, createDayProps, resizeRange);

  const handleDayClick = useCallback(
    (day: string, event: MouseEvent<HTMLButtonElement>) => {
      const pointerType = getPointerType(event);
      lastClickPointerTypeRef.current = pointerType;
      if (
        event.detail === 0 ||
        (event.detail === 1 && isAddAffordanceHit(event, alwaysShowAdd, pointerType))
      ) {
        onCreate?.(dayToDateValue(day));
      }
    },
    [onCreate, alwaysShowAdd],
  );

  const handleSlotDragEnd = useCallback(
    (rangeStart: string, rangeEnd: string) =>
      onCreate?.(slotSelectionToDateValue(rangeStart, rangeEnd, false)),
    [onCreate],
  );

  const handleEventDrop = useCallback(
    ({ eventId, newStart, event }: MonthEventDrop) =>
      onEventMove?.(String(eventId), {
        fromDay: grabbedDayRef.current ?? dayjs(event.start).format("YYYY-MM-DD"),
        toDay: newStart.slice(0, 10),
      }),
    [onEventMove],
  );

  const handleEventClick = useCallback(
    (event: ScheduleEventData) => {
      if (!wasResizing()) onEventClick(event);
    },
    [onEventClick, wasResizing],
  );

  const handleEventDragStart = useCallback(() => setIsDraggingEvent(true), []);
  const handleEventDragEnd = useCallback(() => {
    grabbedDayRef.current = null;
    setIsDraggingEvent(false);
  }, []);

  const dayHeight = Math.max(
    MONTH_DAY_CHROME_HEIGHT + MONTH_EVENT_ROW_HEIGHT,
    Math.floor((height - MONTH_WEEKDAYS_HEIGHT) / MONTH_WEEK_COUNT),
  );
  const maxEventsPerDay = Math.min(
    MONTH_MAX_EVENT_ROWS,
    Math.floor((dayHeight - MONTH_DAY_CHROME_HEIGHT) / MONTH_EVENT_ROW_HEIGHT),
  );
  const slack = dayHeight - MONTH_DAY_CHROME_HEIGHT - maxEventsPerDay * MONTH_EVENT_ROW_HEIGHT;

  const renderEvent = useCallback<CalendarRenderEvent>(
    (event, rootProps) => (
      <CalendarMonthEvent
        event={event}
        rootProps={{
          ...rootProps,
          onDragStart: (dragEvent) => {
            if (resizeIntentRef.current) {
              dragEvent.preventDefault();
              return;
            }
            grabbedDayRef.current = getCalendarDateAt(
              dragEvent.clientX,
              dragEvent.clientY,
              rootRef.current,
            );
            rootProps.onDragStart?.(dragEvent);
          },
        }}
        display={display}
        withPreview={canHover}
        previewDisabled={isDraggingEvent || isResizing || overlaysDisabled}
        onResizeStart={
          canResize ? (edge, pointerEvent) => startResize(event, edge, pointerEvent) : undefined
        }
      />
    ),
    [
      display,
      canHover,
      isDraggingEvent,
      isResizing,
      overlaysDisabled,
      resizeIntentRef,
      canResize,
      startResize,
    ],
  );

  const renderEventBody = useCallback(
    (event: ScheduleEventData) => <CalendarMonthEventBody event={event} display={display} />,
    [display],
  );

  const moreEventsProps = useMemo(
    () => ({
      classNames: {
        moreEventsDropdown: classes.moreEventsDropdown,
        moreEventsList: classes.moreEventsList,
      },
      popoverProps: {
        zIndex: CALENDAR_OVERLAY_Z_INDEX,
        returnFocus: true,
        disabled: overlaysDisabled,
        middlewares: { size: { padding: 8 } },
      },
    }),
    [overlaysDisabled],
  );

  return (
    <MonthView
      ref={rootRef}
      date={date}
      events={events}
      mode="default"
      withHeader={false}
      highlightToday
      firstDayOfWeek={firstDayOfWeek}
      withWeekendDays={showWeekends}
      maxEventsPerDay={maxEventsPerDay}
      labels={labels}
      getDayProps={getDayProps}
      onDayClick={onCreate ? handleDayClick : undefined}
      withDragSlotSelect={!!onCreate && finePointer}
      onSlotDragEnd={handleSlotDragEnd}
      withEventsDragAndDrop={!!onEventMove}
      onEventDrop={handleEventDrop}
      onEventDragStart={handleEventDragStart}
      onEventDragEnd={handleEventDragEnd}
      renderEvent={renderEvent}
      renderEventBody={renderEventBody}
      onEventClick={handleEventClick}
      moreEventsProps={moreEventsProps}
      classNames={{
        monthViewDay: clsx(classes.monthDay, onCreate && classes.monthDayCreatable),
        monthViewEvents: classes.monthEvents,
      }}
      style={{
        "--calendar-month-day-height": `${dayHeight}px`,
        "--calendar-month-slack": `${slack}px`,
      }}
    />
  );
});

type CalendarMobileMonthProps = CalendarMonthSharedProps & {
  onDateSelect: (date: string) => void;
};

export const CalendarMobileMonth = memo(function CalendarMobileMonth({
  date,
  events,
  calendarWindow,
  firstDayOfWeek,
  labels,
  display,
  onEventClick,
  onDateSelect,
}: CalendarMobileMonthProps) {
  const getDayProps = useDayProps(events, calendarWindow);

  const renderEvent = useCallback<CalendarRenderEvent>(
    (event, rootProps) => (
      <CalendarMobileEvent event={event} rootProps={rootProps} display={display} />
    ),
    [display],
  );

  return (
    <MobileMonthView
      date={date}
      selectedDate={date}
      onSelectedDateChange={(value) => {
        if (value) onDateSelect(value.slice(0, 10));
      }}
      events={events}
      mode="default"
      firstDayOfWeek={firstDayOfWeek}
      labels={labels}
      getDayProps={getDayProps}
      renderEvent={renderEvent}
      onEventClick={onEventClick}
      classNames={{ mobileMonthViewHeader: classes.mobileHeader, mobileMonthViewDay: classes.mobileDay }}
    />
  );
});
