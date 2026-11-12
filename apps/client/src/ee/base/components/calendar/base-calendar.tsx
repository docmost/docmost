import "@mantine/schedule/styles.css";
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import { useQueryClient } from "@tanstack/react-query";
import * as liveRegion from "@atlaskit/pragmatic-drag-and-drop-live-region";
import { useMediaQuery } from "@mantine/hooks";
import type { DayOfWeek, ScheduleEventData, ScheduleLabelsOverride } from "@mantine/schedule";
import {
  dateKindOfProperty,
  startOfMonth,
  type DateCell,
} from "@docmost/base-formula/client";
import {
  CalendarLayout,
  FilterGroup,
  IBase,
  IBaseView,
} from "@/ee/base/types/base.types";
import { useCalendarWindowQuery } from "@/ee/base/queries/calendar-window-query";
import { useUpdateCalendarConfig } from "@/ee/base/queries/base-view-query";
import {
  useCreateRowMutation,
  useUpdateRowMutation,
} from "@/ee/base/queries/base-row-query";
import {
  CalendarEventPayload,
  getCalendarWindow,
  isCalendarDate,
  isCalendarDateSourceType,
  isEditableCalendarSource,
  shiftCalendarDate,
  toCalendarEvents,
} from "@/ee/base/services/calendar-adapter";
import {
  dateTypeOptionsOf,
  formatDateCell,
  resolveTimeFormat,
} from "@/ee/base/utils/date-format";
import { orderProperties } from "@/ee/base/utils/property-order";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import { useRowDetailModal } from "@/ee/base/hooks/use-row-detail-modal";
import { RowDetailModal } from "@/ee/base/components/row-detail-modal/row-detail-modal";
import { CalendarHeader } from "@/ee/base/components/calendar/calendar-header";
import { CalendarMobileMonth, CalendarMonth } from "@/ee/base/components/calendar/calendar-month";
import { CalendarWeek } from "@/ee/base/components/calendar/calendar-week";
import { CalendarEmptyState } from "@/ee/base/components/calendar/calendar-empty-state";
import { CalendarErrorFallback } from "@/ee/base/components/calendar/calendar-error-fallback";
import { CalendarFrame } from "@/ee/base/components/calendar/calendar-frame";
import { CalendarSkeleton } from "@/ee/base/components/calendar/calendar-skeleton";
import type { CalendarEventDisplay } from "@/ee/base/components/calendar/calendar-event";

type BaseCalendarProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  embedded?: boolean;
  viewFilter: FilterGroup | undefined;
};

export function BaseCalendar({ base, view, pageId, embedded, viewFilter }: BaseCalendarProps) {
  const { t, i18n } = useTranslation();
  const editable = useBaseEditable();
  const queryClient = useQueryClient();
  const updateCalendarConfig = useUpdateCalendarConfig(pageId, view.id);
  const updateRow = useUpdateRowMutation().mutate;
  const createRow = useCreateRowMutation().mutate;
  const viewer = useViewerDateContext();
  const firstDayOfWeek = viewer.weekStart as DayOfWeek;
  const isMobile = useMediaQuery("(max-width: 48em)", false, {
    getInitialValueInEffect: false,
  });

  const calendarConfig = view.config?.calendar;
  const dateProperty = base.properties.find(
    (p) => p.id === calendarConfig?.datePropertyId && isCalendarDateSourceType(p.type),
  );
  const editableDatePropertyId =
    editable && dateProperty && isEditableCalendarSource(dateProperty)
      ? dateProperty.id
      : undefined;
  const primaryPropertyId = base.properties.find((p) => p.isPrimary)?.id;
  const showWeekends = calendarConfig?.showWeekends ?? true;

  const [localLayout, setLocalLayout] = useState<CalendarLayout | null>(null);
  const layout = localLayout ?? calendarConfig?.layout ?? "month";
  const windowLayout = isMobile ? "mobile" : layout;
  const unit = windowLayout === "week" ? "week" : "month";

  const storageKey = `base-calendar-date:${view.id}`;
  const [date, setDate] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return isCalendarDate(stored) ? stored : viewer.today;
    } catch {
      return viewer.today;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, date);
    } catch {
      return;
    }
  }, [storageKey, date]);

  const { from, to } = getCalendarWindow(windowLayout, date, viewer.weekStart, showWeekends);
  const calendarWindow = useMemo(() => ({ from, to }), [from, to]);

  const kind = dateProperty
    ? dateKindOfProperty(dateProperty.type, dateProperty.typeOptions)
    : null;
  const { rows, total, isTruncated, isLoading, isFetching, isError, refetch } =
    useCalendarWindowQuery(pageId, {
      propertyId: dateProperty?.id,
      kind,
      from,
      to,
      filter: viewFilter,
    });

  const untitledLabel = t("Untitled");
  const events = useMemo(
    () =>
      dateProperty
        ? toCalendarEvents(rows, {
            property: dateProperty,
            primaryPropertyId,
            window: calendarWindow,
            timeZone: viewer.timeZone,
            untitledLabel,
          })
        : [],
    [rows, dateProperty, primaryPropertyId, calendarWindow, viewer.timeZone, untitledLabel],
  );

  const eventsByRowId = useMemo(
    () => new Map(events.map((event) => [event.payload.rowId, event])),
    [events],
  );
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

  const { openRowId, openRow, closeRow } = useRowDetailModal(pageId);
  const modalRows = useMemo(() => {
    const rowIds = events.map((event) => event.payload.rowId);
    if (openRowId && !eventsByRowId.has(openRowId)) rowIds.push(openRowId);
    return rowIds.flatMap((rowId) => {
      const row = rowsById.get(rowId);
      return row ? [row] : [];
    });
  }, [events, eventsByRowId, rowsById, openRowId]);

  const cachedOpenRow = openRowId ? rowsById.get(openRowId) : undefined;
  useEffect(() => {
    if (cachedOpenRow) {
      queryClient.setQueryData(
        ["base-row", cachedOpenRow.pageId, cachedOpenRow.id],
        cachedOpenRow,
        { updatedAt: 0 },
      );
    }
  }, [cachedOpenRow, queryClient]);

  const visiblePropertyIds = view.config?.visiblePropertyIds;
  const propertyOrder = view.config?.propertyOrder;
  const cardProperties = useMemo(() => {
    const visibleIds = visiblePropertyIds ?? [];
    return orderProperties(
      base.properties.filter((p) => visibleIds.includes(p.id) && !p.isPrimary),
      propertyOrder,
    );
  }, [base.properties, visiblePropertyIds, propertyOrder]);

  const locale = i18n.language;
  const dateOptions =
    dateProperty?.type === "date" ? dateTypeOptionsOf(dateProperty.typeOptions) : undefined;
  const display = useMemo<CalendarEventDisplay>(
    () => ({
      pageId: base.id,
      locale,
      dateFormat: dateOptions?.dateFormat,
      timeFormat: resolveTimeFormat(dateOptions?.timeFormat, locale),
      timeZone: viewer.timeZone,
      today: viewer.today,
      cardProperties,
      rowsById,
    }),
    [
      base.id,
      locale,
      dateOptions?.dateFormat,
      dateOptions?.timeFormat,
      viewer.timeZone,
      viewer.today,
      cardProperties,
      rowsById,
    ],
  );

  const labels = useMemo<ScheduleLabelsOverride>(
    () => ({
      moreLabel: (count: number) => t("+{{count}} more", { count }),
      allDay: t("All day"),
      weekday: t("Weekday"),
      timeSlot: t("Time slot"),
      noEvents: t("No events"),
    }),
    [t],
  );

  const openRowRef = useRef(openRow);
  useLayoutEffect(() => {
    openRowRef.current = openRow;
  });
  const handleEventClick = useCallback((event: ScheduleEventData) => {
    openRowRef.current((event.payload as CalendarEventPayload).rowId);
  }, []);
  const handleRowNavigate = useCallback((rowId: string) => {
    openRowRef.current(rowId, { replace: true });
  }, []);

  const timeFormat = display.timeFormat;
  const formatAnnouncedDate = useCallback(
    (value: DateCell) =>
      formatDateCell(value, {
        dateFormat: "full",
        timeFormat,
        locale,
        timeZone: viewer.timeZone,
        today: viewer.today,
      }),
    [timeFormat, locale, viewer.timeZone, viewer.today],
  );

  const updateEventDate = useCallback(
    (rowId: string, next: DateCell, announce: (title: string, date: string) => string) => {
      const event = eventsByRowId.get(rowId);
      if (!event || !editableDatePropertyId) return;
      updateRow(
        { pageId, rowId, cells: { [editableDatePropertyId]: next } },
        {
          onSuccess: () =>
            liveRegion.announce(announce(event.title, formatAnnouncedDate(next))),
        },
      );
    },
    [eventsByRowId, editableDatePropertyId, pageId, updateRow, formatAnnouncedDate],
  );

  const handleEventMove = useCallback(
    (rowId: string, next: DateCell) =>
      updateEventDate(rowId, next, (title, date) =>
        t("Moved {{title}} to {{date}}", { title, date }),
      ),
    [updateEventDate, t],
  );

  const handleEventResize = useCallback(
    (rowId: string, next: DateCell) =>
      updateEventDate(rowId, next, (title, date) =>
        t("Resized {{title}} to {{date}}", { title, date }),
      ),
    [updateEventDate, t],
  );

  const creatingRef = useRef(false);
  const handleCreate = useCallback(
    (value: DateCell) => {
      if (!editableDatePropertyId || creatingRef.current) return;
      creatingRef.current = true;
      createRow(
        { pageId, cells: { [editableDatePropertyId]: value } },
        {
          onSuccess: (row) => {
            queryClient.setQueryData(["base-row", row.pageId, row.id], row);
            liveRegion.announce(
              t("Created record for {{date}}", { date: formatAnnouncedDate(value) }),
            );
            openRowRef.current(row.id);
          },
          onSettled: () => {
            creatingRef.current = false;
          },
        },
      );
    },
    [editableDatePropertyId, pageId, createRow, queryClient, formatAnnouncedDate, t],
  );

  const interactionProps = editableDatePropertyId
    ? {
        onEventMove: handleEventMove,
        onEventResize: handleEventResize,
        onCreate: handleCreate,
      }
    : {};

  const handleNavigate = useCallback(
    (step: 1 | -1) =>
      setDate((d) => shiftCalendarDate(d, unit, step)),
    [unit],
  );
  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);
  const today = viewer.today;
  const handleToday = useCallback(() => setDate(today), [today]);
  const handleLayoutChange = useCallback(
    (next: CalendarLayout) => {
      if (next === "week" && layout === "month") {
        setDate((d) => (today.slice(0, 7) === d.slice(0, 7) ? today : startOfMonth(d)));
      }
      if (!editable) {
        setLocalLayout(next);
        return;
      }
      updateCalendarConfig({ layout: next });
    },
    [layout, today, editable, updateCalendarConfig],
  );

  const [surfaceHeight, setSurfaceHeight] = useState(0);
  const measureSurface = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const update = () => setSurfaceHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const viewProps = {
    date,
    events,
    firstDayOfWeek,
    labels,
    display,
    onEventClick: handleEventClick,
  };

  let content: ReactNode = null;
  if (!dateProperty || !kind) {
    content = <CalendarEmptyState base={base} view={view} pageId={pageId} />;
  } else if (isError && rows.length === 0) {
    content = <CalendarErrorFallback onRetry={handleRetry} />;
  } else if (isLoading) {
    content = <CalendarSkeleton layout={windowLayout} />;
  } else if (surfaceHeight > 0) {
    content = (
      <ErrorBoundary
        resetKeys={[windowLayout, from, to, dateProperty.id, events]}
        fallbackRender={({ resetErrorBoundary }) => (
          <CalendarErrorFallback
            onRetry={() => {
              handleRetry();
              resetErrorBoundary();
            }}
          />
        )}
      >
        {windowLayout === "mobile" ? (
          <CalendarMobileMonth
            {...viewProps}
            calendarWindow={calendarWindow}
            onDateSelect={setDate}
          />
        ) : windowLayout === "week" ? (
          <CalendarWeek
            key={kind}
            {...viewProps}
            {...interactionProps}
            kind={kind}
            height={surfaceHeight}
            showWeekends={showWeekends}
          />
        ) : (
          <CalendarMonth
            {...viewProps}
            {...interactionProps}
            kind={kind}
            calendarWindow={calendarWindow}
            height={surfaceHeight}
            showWeekends={showWeekends}
            overlaysDisabled={!!openRowId}
          />
        )}
      </ErrorBoundary>
    );
  }

  return (
    <>
      <CalendarFrame
        embedded={embedded}
        surfaceRef={measureSurface}
        busy={isFetching}
        header={
          dateProperty && (
            <CalendarHeader
              unit={unit}
              date={date}
              calendarWindow={calendarWindow}
              layout={layout}
              withLayoutSwitch={!isMobile}
              isTruncated={isTruncated}
              total={total}
              hasLoadError={isError && rows.length > 0}
              onRetry={handleRetry}
              onLayoutChange={handleLayoutChange}
              onNavigate={handleNavigate}
              onToday={handleToday}
            />
          )
        }
      >
        {content}
      </CalendarFrame>
      <RowDetailModal
        base={base}
        rows={modalRows}
        openRowId={openRowId}
        onClose={closeRow}
        onNavigate={handleRowNavigate}
      />
    </>
  );
}
