import { PointerEvent } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import {
  HoverCard,
  Text,
  UnstyledButton,
  getDefaultZIndex,
  getThemeColor,
  useMantineTheme,
} from "@mantine/core";
import type { MonthViewProps, ScheduleEventData } from "@mantine/schedule";
import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import type { CalendarEventPayload } from "@/ee/base/services/calendar-events";
import { getMonthEventDayRange } from "@/ee/base/services/calendar-date-math";
import { systemAccessorFor } from "@/ee/base/property-types/property-type.registry";
import { CardField } from "@/ee/base/components/kanban/card-field/card-field";
import {
  ResizeEdge,
  getResizeEdges,
} from "@/ee/base/components/calendar/use-calendar-month-resize";
import {
  DateFormat,
  DateValue,
  formatDateValue,
  formatTimeOfDay,
  isDateOnly,
  localDateToYmd,
} from "@/ee/base/utils/date-value";
import classes from "@/ee/base/styles/calendar.module.css";

export const CALENDAR_OVERLAY_Z_INDEX = getDefaultZIndex("modal");

const WEEK_INLINE_FIELD_LIMIT = 3;

export type CalendarRenderEvent = NonNullable<MonthViewProps["renderEvent"]>;
type CalendarEventRootProps = Parameters<CalendarRenderEvent>[1];

export type CalendarEventDisplay = {
  pageId: string;
  locale: string;
  dateFormat: DateFormat | undefined;
  timeFormat: "12h" | "24h";
  cardProperties: IBaseProperty[];
  rowsById: Map<string, IBaseRow>;
};

type CalendarEventProps = {
  event: ScheduleEventData;
  display: CalendarEventDisplay;
};

type CalendarEventButtonProps = CalendarEventProps & {
  rootProps: CalendarEventRootProps;
};

function getPayload(event: ScheduleEventData): CalendarEventPayload {
  return event.payload as CalendarEventPayload;
}

function formatEventLabel(event: ScheduleEventData, display: CalendarEventDisplay) {
  const date = formatDateValue(getPayload(event).value, {
    dateFormat: "full",
    timeFormat: display.timeFormat,
    locale: display.locale,
  });
  return `${event.title}, ${date}`;
}

function formatEventWhen(
  value: DateValue,
  display: CalendarEventDisplay,
  allDayLabel: string,
) {
  if (isDateOnly(value.start)) {
    return value.end && value.end !== value.start
      ? formatDateValue(value, { dateFormat: "medium", locale: display.locale })
      : allDayLabel;
  }
  const start = formatTimeOfDay(value.start, display);
  if (!value.end || value.end === value.start) return start;
  const sameDay =
    localDateToYmd(new Date(value.start)) === localDateToYmd(new Date(value.end));
  return sameDay
    ? `${start} – ${formatTimeOfDay(value.end, display)}`
    : formatDateValue(value, {
        dateFormat: "medium",
        timeFormat: display.timeFormat,
        locale: display.locale,
      });
}

function getCardFields(event: ScheduleEventData, display: CalendarEventDisplay) {
  const row = display.rowsById.get(getPayload(event).rowId);
  if (!row) return [];
  return display.cardProperties.flatMap((property) => {
    const accessor = systemAccessorFor(property.type);
    const value = accessor ? accessor(row) : row.cells[property.id];
    const isEmpty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    return isEmpty ? [] : [{ property, value }];
  });
}

function CalendarEventPreview({ event, display }: CalendarEventProps) {
  return (
    <div className={classes.preview}>
      <Text size="sm" fw={600} lineClamp={2}>
        {event.title}
      </Text>
      <Text size="xs" c="dimmed">
        {formatDateValue(getPayload(event).value, {
          dateFormat: display.dateFormat,
          timeFormat: display.timeFormat,
          locale: display.locale,
        })}
      </Text>
      {getCardFields(event, display).map(({ property, value }) => (
        <CardField
          key={property.id}
          property={property}
          value={value}
          pageId={display.pageId}
        />
      ))}
    </div>
  );
}

export function CalendarMonthEvent({
  event,
  rootProps,
  display,
  withPreview,
  previewDisabled,
  onResizeStart,
}: CalendarEventButtonProps & {
  withPreview: boolean;
  previewDisabled: boolean;
  onResizeStart?: (edge: ResizeEdge, pointerEvent: PointerEvent<HTMLElement>) => void;
}) {
  const [firstDay, lastDay] = getMonthEventDayRange(event.start, event.end);
  const isTimedDay = !isDateOnly(getPayload(event).value.start) && firstDay === lastDay;
  const resizeEdges = onResizeStart
    ? getResizeEdges("mod" in rootProps ? rootProps.mod : undefined)
    : null;
  const button = (
    <UnstyledButton
      {...rootProps}
      className={clsx(rootProps.className, isTimedDay && classes.monthTimedEvent)}
      title={undefined}
      aria-label={formatEventLabel(event, display)}
    >
      {rootProps.children}
      {resizeEdges?.start && (
        <span
          className={classes.monthResizeHandle}
          data-edge="start"
          aria-hidden
          onPointerDown={(e) => onResizeStart?.("start", e)}
        />
      )}
      {resizeEdges?.end && (
        <span
          className={classes.monthResizeHandle}
          data-edge="end"
          aria-hidden
          onPointerDown={(e) => onResizeStart?.("end", e)}
        />
      )}
    </UnstyledButton>
  );
  if (!withPreview) return button;
  return (
    <HoverCard
      openDelay={400}
      closeDelay={100}
      position="right-start"
      width={280}
      shadow="md"
      withinPortal
      withRoles={false}
      zIndex={CALENDAR_OVERLAY_Z_INDEX}
      disabled={previewDisabled}
    >
      <HoverCard.Target>{button}</HoverCard.Target>
      <HoverCard.Dropdown>
        <CalendarEventPreview event={event} display={display} />
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

export function CalendarMonthEventBody({ event, display }: CalendarEventProps) {
  const { value } = getPayload(event);
  if (isDateOnly(value.start)) return event.title;
  return (
    <>
      <span className={classes.eventDot} aria-hidden />
      <span className={classes.eventTime}>
        {formatTimeOfDay(value.start, display)}
      </span>
      {event.title}
    </>
  );
}

export function CalendarWeekEvent({ event, rootProps, display }: CalendarEventButtonProps) {
  const label = formatEventLabel(event, display);
  return <UnstyledButton {...rootProps} title={label} aria-label={label} />;
}

export function CalendarWeekEventBody({ event, display }: CalendarEventProps) {
  const { t } = useTranslation();
  const fields = getCardFields(event, display).slice(0, WEEK_INLINE_FIELD_LIMIT);
  return (
    <span className={classes.weekEventBody}>
      <span className={classes.weekEventLine}>{event.title}</span>
      <span className={clsx(classes.weekEventLine, classes.weekEventTime)}>
        {formatEventWhen(getPayload(event).value, display, t("All day"))}
      </span>
      {fields.length > 0 && (
        <span className={classes.weekEventFields} inert>
          {fields.map(({ property, value }) => (
            <CardField
              key={property.id}
              property={property}
              value={value}
              pageId={display.pageId}
            />
          ))}
        </span>
      )}
    </span>
  );
}

export function CalendarMobileEvent({ event, rootProps, display }: CalendarEventButtonProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  return (
    <UnstyledButton {...rootProps} aria-label={formatEventLabel(event, display)}>
      <span className={classes.mobileEventBody}>
        <span
          className={classes.mobileEventColor}
          style={{ backgroundColor: getThemeColor(event.color, theme) }}
        />
        <span className={classes.mobileEventText}>
          <span className={classes.mobileEventTitle}>{event.title}</span>
          <span className={classes.mobileEventTime}>
            {formatEventWhen(getPayload(event).value, display, t("All day"))}
          </span>
        </span>
      </span>
    </UnstyledButton>
  );
}
