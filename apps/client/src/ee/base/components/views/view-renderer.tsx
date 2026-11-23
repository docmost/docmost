import { lazy, Suspense, useState } from "react";
import { Table } from "@tanstack/react-table";
import { ErrorBoundary } from "react-error-boundary";
import {
  IBase,
  IBaseRow,
  IBaseView,
  FilterGroup,
} from "@/ee/base/types/base.types";
import { BaseTable } from "@/ee/base/components/base-table";
import { BaseKanban } from "@/ee/base/components/kanban/base-kanban";
import { BaseForm } from "@/ee/base/components/form/base-form";
import { CalendarFrame } from "@/ee/base/components/calendar/calendar-frame";
import { CalendarErrorFallback } from "@/ee/base/components/calendar/calendar-error-fallback";
import { CalendarSkeleton } from "@/ee/base/components/calendar/calendar-skeleton";

const loadBaseCalendar = () =>
  import("@/ee/base/components/calendar/base-calendar").then((m) => ({
    default: m.BaseCalendar,
  }));
const BaseCalendar = lazy(loadBaseCalendar);

type CalendarBoundaryProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  embedded?: boolean;
  viewFilter: FilterGroup | undefined;
};

function CalendarBoundary({ view, embedded, ...props }: CalendarBoundaryProps) {
  const [Calendar, setCalendar] = useState(() => BaseCalendar);
  return (
    <ErrorBoundary
      resetKeys={[view.id]}
      onReset={() => setCalendar(() => lazy(loadBaseCalendar))}
      fallbackRender={({ resetErrorBoundary }) => (
        <CalendarFrame embedded={embedded}>
          <CalendarErrorFallback onRetry={resetErrorBoundary} />
        </CalendarFrame>
      )}
    >
      <Suspense
        fallback={
          <CalendarFrame embedded={embedded} busy>
            <CalendarSkeleton layout={view.config?.calendar?.layout ?? "month"} />
          </CalendarFrame>
        }
      >
        <Calendar key={view.id} view={view} embedded={embedded} {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

type ViewRendererProps = {
  base: IBase;
  rows: IBaseRow[];
  effectiveView: IBaseView | undefined;
  table: Table<IBaseRow>;
  pageId: string;
  embedded?: boolean;
  editable: boolean;
  isFiltered: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onCellUpdate: (rowId: string, propertyId: string, value: unknown) => void;
  onAddRow: (afterRowId?: string, focusPropertyId?: string) => void;
  onColumnReorder: (columnId: string, finishIndex: number) => void;
  onResizeEnd: () => void;
  onRowReorder: (
    rowId: string,
    targetRowId: string,
    dropPosition: "above" | "below",
  ) => void;
  persistViewConfig: () => void;
  scrollportRef: React.RefObject<HTMLDivElement>;
  aboveBand?: React.ReactNode;
  activeFilter?: FilterGroup | undefined;
};

export function ViewRenderer(props: ViewRendererProps) {
  const viewType = props.effectiveView?.type ?? "table";

  if (viewType === "kanban") {
    return (
      <BaseKanban
        base={props.base}
        view={props.effectiveView!}
        pageId={props.pageId}
        embedded={props.embedded}
        editable={props.editable}
        viewFilter={props.activeFilter}
      />
    );
  }

  if (viewType === "form") {
    return (
      <BaseForm
        key={props.effectiveView!.id}
        base={props.base}
        view={props.effectiveView!}
        pageId={props.pageId}
        editable={props.editable}
        embedded={props.embedded}
      />
    );
  }

  if (viewType === "calendar") {
    return (
      <CalendarBoundary
        base={props.base}
        view={props.effectiveView!}
        pageId={props.pageId}
        embedded={props.embedded}
        viewFilter={props.activeFilter}
      />
    );
  }

  if (viewType === "table") {
    return <BaseTable {...props} />;
  }

  return <BaseTable {...props} />;
}
