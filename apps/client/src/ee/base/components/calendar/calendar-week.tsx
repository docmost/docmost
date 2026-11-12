import { DragEvent, MouseEvent, memo, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@mantine/hooks";
import { WeekView } from "@mantine/schedule";
import type {
  DayOfWeek,
  ScheduleEventData,
  ScheduleLabelsOverride,
  WeekViewProps,
} from "@mantine/schedule";
import type { DateCell, DateKind } from "@docmost/base-formula/client";
import {
  CalendarEvent,
  TIME_SNAP_MINUTES,
  WEEK_SLOT_MINUTES,
  createOnDays,
  createOnSlots,
  dropOnWeek,
  isAllDayLane,
  resizeOnWeek,
  slotTimeAt,
} from "@/ee/base/services/calendar-adapter";
import {
  CalendarEventDisplay,
  CalendarRenderEvent,
  CalendarWeekEvent,
  CalendarWeekEventBody,
} from "@/ee/base/components/calendar/calendar-event";
import classes from "@/ee/base/styles/calendar.module.css";

const WEEK_VIEW_BORDER_HEIGHT = 2;
const WEEK_START_SCROLL_TIME = "08:00:00";
const WEEK_DROP_INTERVAL_MINUTES = 1;
const WEEK_GRID_START = "00:00:00";
const WEEK_GRID_END = "23:59:59";

type WeekEventChange = Parameters<NonNullable<WeekViewProps["onEventDrop"]>>[0];
type WeekTimeSlotClick = Parameters<NonNullable<WeekViewProps["onTimeSlotClick"]>>[0];

function getGrabTime(dragEvent: DragEvent<HTMLButtonElement>): string | null {
  const slot = document
    .elementsFromPoint(dragEvent.clientX, dragEvent.clientY)
    .find((element): element is HTMLElement => element instanceof HTMLElement && !!element.dataset.slotTime);
  const { calendarDate, slotTime } = slot?.dataset ?? {};
  if (!slot || !calendarDate || !slotTime) return null;
  const rect = slot.getBoundingClientRect();
  return slotTimeAt(calendarDate, slotTime, (dragEvent.clientY - rect.top) / rect.height);
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
  kind: DateKind;
  onEventClick: (event: ScheduleEventData) => void;
  onEventMove?: (rowId: string, next: DateCell) => void;
  onEventResize?: (rowId: string, next: DateCell) => void;
  onCreate?: (value: DateCell) => void;
};

export const CalendarWeek = memo(function CalendarWeek({
  date,
  events,
  height,
  firstDayOfWeek,
  showWeekends,
  labels,
  display,
  kind,
  onEventClick,
  onEventMove,
  onEventResize,
  onCreate,
}: CalendarWeekProps) {
  const { t } = useTranslation();
  const { timeFormat, locale, timeZone } = display;
  const finePointer = useMediaQuery("(pointer: fine)", true, {
    getInitialValueInEffect: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const grabbedDayRef = useRef<string | null>(null);
  const grabTimeRef = useRef<string | null>(null);

  const timeLabelFormat = useMemo(() => {
    if (timeFormat === "24h") return "HH:mm";
    const hourFormat = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      hourCycle: "h12",
      timeZone: "UTC",
    });
    const minuteFormat = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h12",
      timeZone: "UTC",
    });
    return (value: string) => {
      const hour = Number(value.slice(11, 13));
      const minute = Number(value.slice(14, 16));
      const format = minute === 0 ? hourFormat : minuteFormat;
      return format.format(Date.UTC(2000, 0, 1, hour, minute));
    };
  }, [timeFormat, locale]);

  const renderEvent = useCallback<CalendarRenderEvent>(
    (event, rootProps) => (
      <CalendarWeekEvent
        event={event}
        rootProps={{
          ...rootProps,
          onDragStart: (dragEvent) => {
            if (isAllDayLane(event as CalendarEvent)) {
              grabbedDayRef.current = getColumnDateAt(rootRef.current, dragEvent.clientX);
            } else {
              grabTimeRef.current = getGrabTime(dragEvent);
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
      const next = dropOnWeek(
        event as CalendarEvent,
        newStart,
        { day: grabbedDayRef.current, time: grabTimeRef.current },
        timeZone,
      );
      if (next) onEventMove?.(String(eventId), next);
    },
    [onEventMove, timeZone],
  );

  const handleEventDragEnd = useCallback(() => {
    grabbedDayRef.current = null;
    grabTimeRef.current = null;
  }, []);

  const handleEventResize = useCallback(
    ({ eventId, newStart, newEnd, event }: WeekEventChange) => {
      const next = resizeOnWeek(event as CalendarEvent, newStart, newEnd, timeZone);
      if (next) onEventResize?.(String(eventId), next);
    },
    [onEventResize, timeZone],
  );

  const createWith = useCallback(
    (create: () => DateCell) => {
      if (!onCreate) return;
      let value: DateCell;
      try {
        value = create();
      } catch (err) {
        if (err instanceof RangeError) return;
        throw err;
      }
      onCreate(value);
    },
    [onCreate],
  );

  const getTimeSlotProps = useCallback(
    ({ start, end }: { start: string; end: string }) => ({
      "data-calendar-date": start.slice(0, 10),
      "data-slot-time": start.slice(11),
      onDoubleClick:
        onCreate && (() => createWith(() => createOnSlots(kind, start, end, timeZone))),
    }),
    [onCreate, createWith, kind, timeZone],
  );

  const handleTimeSlotClick = useCallback(
    ({ slotStart, slotEnd, nativeEvent }: WeekTimeSlotClick) => {
      if (nativeEvent.detail === 0) {
        createWith(() => createOnSlots(kind, slotStart, slotEnd, timeZone));
      }
    },
    [createWith, kind, timeZone],
  );

  const handleAllDaySlotClick = useCallback(
    (day: string, event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 || event.detail === 2) {
        createWith(() => createOnDays(kind, day, day, timeZone));
      }
    },
    [createWith, kind, timeZone],
  );

  const handleSlotDragEnd = useCallback(
    (rangeStart: string, rangeEnd: string) =>
      createWith(() => createOnSlots(kind, rangeStart, rangeEnd, timeZone)),
    [createWith, kind, timeZone],
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
