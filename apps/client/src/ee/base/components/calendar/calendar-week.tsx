import { DragEvent, MouseEvent, memo, useCallback, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@mantine/hooks";
import { WeekView, calculateDropTime, isAllDayEvent } from "@mantine/schedule";
import type {
  DayOfWeek,
  ScheduleEventData,
  ScheduleLabelsOverride,
  WeekViewProps,
} from "@mantine/schedule";
import type { CalendarEvent } from "@/ee/base/services/calendar-events";
import {
  DateMove,
  DateResize,
  TIME_SNAP_MINUTES,
  dayToDateValue,
  slotSelectionToDateValue,
} from "@/ee/base/services/calendar-date-math";
import {
  CalendarEventDisplay,
  CalendarRenderEvent,
  CalendarWeekEvent,
  CalendarWeekEventBody,
} from "@/ee/base/components/calendar/calendar-event";
import { DateValue, formatTimeOfDay } from "@/ee/base/utils/date-value";
import classes from "@/ee/base/styles/calendar.module.css";

const WEEK_VIEW_BORDER_HEIGHT = 2;
const WEEK_START_SCROLL_TIME = "08:00:00";
const MANTINE_DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const WEEK_SLOT_MINUTES = 60;
const WEEK_DROP_INTERVAL_MINUTES = 1;
const WEEK_GRID_START = "00:00:00";
const WEEK_GRID_END = "23:59:59";

type WeekEventChange = Parameters<NonNullable<WeekViewProps["onEventDrop"]>>[0];
type WeekTimeSlotClick = Parameters<NonNullable<WeekViewProps["onTimeSlotClick"]>>[0];

function isAllDayLaneEvent(event: ScheduleEventData): boolean {
  const start = dayjs(event.start);
  const end = dayjs(event.end);
  const endDay =
    end.hour() === 0 && end.minute() === 0
      ? end.startOf("day").subtract(1, "day")
      : end.startOf("day");
  return endDay.isAfter(start.startOf("day")) || isAllDayEvent({ event, date: start });
}

function getGrabTime(
  dragEvent: DragEvent<HTMLButtonElement>,
  event: ScheduleEventData,
): string | null {
  const slot = document
    .elementsFromPoint(dragEvent.clientX, dragEvent.clientY)
    .find((element): element is HTMLElement => element instanceof HTMLElement && !!element.dataset.slotTime);
  if (!slot) return null;
  const rect = slot.getBoundingClientRect();
  const { start } = calculateDropTime({
    draggedEvent: event,
    targetDate: slot.dataset.calendarDate,
    targetSlotTime: slot.dataset.slotTime,
    intervalMinutes: WEEK_SLOT_MINUTES,
    dragIntervalMinutes: WEEK_DROP_INTERVAL_MINUTES,
    slotOffset: dragEvent.clientY - rect.top,
    slotSize: rect.height,
    startTime: WEEK_GRID_START,
    endTime: WEEK_GRID_END,
  });
  return dayjs(start).format(MANTINE_DATE_TIME_FORMAT);
}

function getColumnDateAt(root: HTMLElement | null, x: number): string | null {
  for (const slot of root?.querySelectorAll<HTMLElement>("[data-calendar-date]") ?? []) {
    const { left, right } = slot.getBoundingClientRect();
    if (x >= left && x < right) return slot.dataset.calendarDate ?? null;
  }
  return null;
}

type CalendarWeekProps = {
  date: string;
  events: CalendarEvent[];
  height: number;
  firstDayOfWeek: DayOfWeek;
  showWeekends: boolean;
  labels: ScheduleLabelsOverride;
  display: CalendarEventDisplay;
  onEventClick: (event: ScheduleEventData) => void;
  onEventMove?: (eventId: string, move: DateMove) => void;
  onEventResize?: (eventId: string, resize: DateResize) => void;
  onCreate?: (value: DateValue) => void;
};

export const CalendarWeek = memo(function CalendarWeek({
  date,
  events,
  height,
  firstDayOfWeek,
  showWeekends,
  labels,
  display,
  onEventClick,
  onEventMove,
  onEventResize,
  onCreate,
}: CalendarWeekProps) {
  const { t } = useTranslation();
  const { timeFormat, locale } = display;
  const finePointer = useMediaQuery("(pointer: fine)", true, {
    getInitialValueInEffect: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const grabbedDayRef = useRef<string | null>(null);
  const grabTimeRef = useRef<string | null>(null);

  const timeLabelFormat = useMemo(() => {
    if (timeFormat === "24h") return "HH:mm";
    const hourFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", hourCycle: "h12" });
    return (value: string) => {
      const time = dayjs(value);
      return time.minute() === 0
        ? hourFormat.format(time.toDate())
        : formatTimeOfDay(time.toISOString(), { timeFormat, locale });
    };
  }, [timeFormat, locale]);

  const renderEvent = useCallback<CalendarRenderEvent>(
    (event, rootProps) => (
      <CalendarWeekEvent
        event={event}
        rootProps={{
          ...rootProps,
          onDragStart: (dragEvent) => {
            if (isAllDayLaneEvent(event)) {
              grabbedDayRef.current = getColumnDateAt(rootRef.current, dragEvent.clientX);
            } else {
              grabTimeRef.current = getGrabTime(dragEvent, event);
            }
            rootProps.onDragStart?.(dragEvent);
          },
        }}
        display={display}
      />
    ),
    [display],
  );

  const renderEventBody = useCallback(
    (event: ScheduleEventData) => <CalendarWeekEventBody event={event} display={display} />,
    [display],
  );

  const handleEventDrop = useCallback(
    ({ eventId, newStart, event }: WeekEventChange) => {
      if (!isAllDayLaneEvent(event)) {
        onEventMove?.(String(eventId), {
          grabTime: grabTimeRef.current ?? dayjs(event.start).format(MANTINE_DATE_TIME_FORMAT),
          dropTime: newStart,
        });
        return;
      }
      onEventMove?.(String(eventId), {
        fromDay: grabbedDayRef.current ?? dayjs(event.start).format("YYYY-MM-DD"),
        toDay: newStart.slice(0, 10),
      });
    },
    [onEventMove],
  );

  const handleEventDragEnd = useCallback(() => {
    grabbedDayRef.current = null;
    grabTimeRef.current = null;
  }, []);

  const handleEventResize = useCallback(
    ({ eventId, newStart, newEnd, event }: WeekEventChange) => {
      const start = dayjs(event.start).format(MANTINE_DATE_TIME_FORMAT);
      const end = dayjs(event.end).format(MANTINE_DATE_TIME_FORMAT);
      if (newStart === start && newEnd === end) return;
      onEventResize?.(String(eventId), {
        edge: newStart !== start ? "start" : "end",
        start: newStart,
        end: newEnd,
      });
    },
    [onEventResize],
  );

  const getTimeSlotProps = useCallback(
    ({ start, end }: { start: string; end: string }) => ({
      "data-calendar-date": start.slice(0, 10),
      "data-slot-time": start.slice(11),
      onDoubleClick: onCreate && (() => onCreate(slotSelectionToDateValue(start, end, true))),
    }),
    [onCreate],
  );

  const handleTimeSlotClick = useCallback(
    ({ slotStart, slotEnd, nativeEvent }: WeekTimeSlotClick) => {
      if (nativeEvent.detail === 0) onCreate?.(slotSelectionToDateValue(slotStart, slotEnd, true));
    },
    [onCreate],
  );

  const handleAllDaySlotClick = useCallback(
    (day: string, event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 || event.detail === 2) onCreate?.(dayToDateValue(day));
    },
    [onCreate],
  );

  const handleSlotDragEnd = useCallback(
    (rangeStart: string, rangeEnd: string) =>
      onCreate?.(slotSelectionToDateValue(rangeStart, rangeEnd, true)),
    [onCreate],
  );

  const createHint = onCreate ? t("Press Enter to create a record") : undefined;
  const attributes = useMemo(
    () => ({
      weekViewDayLabel: { inert: true },
      weekViewDaySlot: { "aria-description": createHint },
    }),
    [createHint],
  );

  return (
    <WeekView
      ref={rootRef}
      date={date}
      events={events}
      mode="default"
      withHeader={false}
      highlightToday
      withWeekNumber={false}
      firstDayOfWeek={firstDayOfWeek}
      withWeekendDays={showWeekends}
      labels={labels}
      slotLabelFormat={timeLabelFormat}
      startScrollTime={WEEK_START_SCROLL_TIME}
      scrollAreaProps={{ mah: height - WEEK_VIEW_BORDER_HEIGHT }}
      renderEvent={renderEvent}
      renderEventBody={renderEventBody}
      onEventClick={onEventClick}
      intervalMinutes={WEEK_SLOT_MINUTES}
      startTime={WEEK_GRID_START}
      endTime={WEEK_GRID_END}
      withEventsDragAndDrop={!!onEventMove}
      eventDragInterval={WEEK_DROP_INTERVAL_MINUTES}
      onEventDrop={handleEventDrop}
      onEventDragEnd={handleEventDragEnd}
      withEventResize={!!onEventResize}
      eventResizeInterval={TIME_SNAP_MINUTES}
      onEventResize={handleEventResize}
      withDragSlotSelect={!!onCreate && finePointer}
      onSlotDragEnd={handleSlotDragEnd}
      onTimeSlotClick={onCreate ? handleTimeSlotClick : undefined}
      onAllDaySlotClick={onCreate ? handleAllDaySlotClick : undefined}
      getTimeSlotProps={getTimeSlotProps}
      classNames={{
        weekViewDayLabel: classes.weekDayLabel,
        weekViewDragPreview: classes.weekDragPreview,
      }}
      attributes={attributes}
    />
  );
});
