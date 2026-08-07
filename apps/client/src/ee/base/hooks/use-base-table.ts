import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  ColumnDef,
  SortingState,
  ColumnSizingState,
  VisibilityState,
  ColumnOrderState,
  ColumnPinningState,
  Table,
} from "@tanstack/react-table";
import {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
  ViewConfig,
  ViewConfigPatch,
} from "@/ee/base/types/base.types";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { systemAccessorFor } from "@/ee/base/property-types/property-type.registry";

const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 600;
const ROW_NUMBER_COLUMN_WIDTH = 64;

const columnHelper = createColumnHelper<IBaseRow>();

function buildColumns(properties: IBaseProperty[]): ColumnDef<IBaseRow, unknown>[] {
  const rowNumberColumn = columnHelper.display({
    id: "__row_number",
    header: "#",
    size: ROW_NUMBER_COLUMN_WIDTH,
    minSize: ROW_NUMBER_COLUMN_WIDTH,
    maxSize: ROW_NUMBER_COLUMN_WIDTH,
    enableResizing: false,
    enableSorting: false,
    enableHiding: false,
  });

  const propertyColumns = properties.map((property) => {
    const sysAccessor = systemAccessorFor(property.type);
    if (sysAccessor) {
      return columnHelper.accessor(sysAccessor, {
        id: property.id,
        header: property.name,
        size: DEFAULT_COLUMN_WIDTH,
        minSize: MIN_COLUMN_WIDTH,
        maxSize: MAX_COLUMN_WIDTH,
        enableResizing: true,
        enableSorting: false,
        enableHiding: !property.isPrimary,
        meta: { property },
      });
    }

    return columnHelper.accessor((row) => row.cells[property.id], {
      id: property.id,
      header: property.name,
      size: DEFAULT_COLUMN_WIDTH,
      minSize: MIN_COLUMN_WIDTH,
      maxSize: MAX_COLUMN_WIDTH,
      enableResizing: true,
      enableSorting: true,
      enableHiding: !property.isPrimary,
      meta: { property },
    });
  });

  return [rowNumberColumn, ...propertyColumns];
}

function buildSortingState(config: ViewConfig | undefined): SortingState {
  if (!config?.sorts?.length) return [];
  return config.sorts.map((sort) => ({
    id: sort.propertyId,
    desc: sort.direction === "desc",
  }));
}

function buildColumnSizing(
  config: ViewConfig | undefined,
): ColumnSizingState {
  const sizing: ColumnSizingState = {
    __row_number: ROW_NUMBER_COLUMN_WIDTH,
  };
  if (config?.propertyWidths) {
    Object.entries(config.propertyWidths).forEach(([id, width]) => {
      sizing[id] = width;
    });
  }
  return sizing;
}

function buildColumnVisibility(
  config: ViewConfig | undefined,
  properties: IBaseProperty[],
): VisibilityState {
  const visibility: VisibilityState = { __row_number: true };

  if (config?.hiddenPropertyIds) {
    const hiddenSet = new Set(config.hiddenPropertyIds);
    properties.forEach((p) => {
      visibility[p.id] = !hiddenSet.has(p.id);
    });
    return visibility;
  }

  if (config?.visiblePropertyIds?.length) {
    const visibleSet = new Set(config.visiblePropertyIds);
    properties.forEach((p) => {
      visibility[p.id] = visibleSet.has(p.id);
    });
    return visibility;
  }

  properties.forEach((p) => {
    visibility[p.id] = true;
  });
  return visibility;
}

function buildColumnOrder(
  config: ViewConfig | undefined,
  properties: IBaseProperty[],
): ColumnOrderState {
  if (config?.propertyOrder?.length) {
    const orderSet = new Set(config.propertyOrder);
    const missing = properties
      .filter((p) => !orderSet.has(p.id))
      .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
      .map((p) => p.id);
    return ["__row_number", ...config.propertyOrder, ...missing];
  }
  const sorted = [...properties].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
  });
  return ["__row_number", ...sorted.map((p) => p.id)];
}

function buildColumnPinning(
  properties: IBaseProperty[],
  pinPrimary: boolean,
): ColumnPinningState {
  const primary = pinPrimary ? properties.find((p) => p.isPrimary) : undefined;
  return {
    left: primary ? ["__row_number", primary.id] : ["__row_number"],
    right: [],
  };
}

export function buildLayoutConfigPatch(table: Table<IBaseRow>): ViewConfigPatch {
  const state = table.getState();

  const propertyWidths: Record<string, number> = {};
  Object.entries(state.columnSizing).forEach(([id, width]) => {
    if (id !== "__row_number") {
      // Resize state can hold the raw drag value below minSize; rendering
      // clamps via getSize(), so persist the clamped value too.
      propertyWidths[id] = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, width),
      );
    }
  });

  const propertyOrder = state.columnOrder.filter((id) => id !== "__row_number");

  const hiddenPropertyIds = Object.entries(state.columnVisibility)
    .filter(([id, visible]) => id !== "__row_number" && !visible)
    .map(([id]) => id);

  return {
    propertyWidths,
    propertyOrder,
    hiddenPropertyIds,
    visiblePropertyIds: null,
  };
}

export type UseBaseTableResult = {
  table: Table<IBaseRow>;
  persistViewConfig: () => void;
};

export function useBaseTable(
  base: IBase | undefined,
  rows: IBaseRow[],
  activeView: IBaseView | undefined,
): UseBaseTableResult {
  const updateViewMutation = useUpdateViewMutation();
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While a local edit is pending the reconcile effect preserves local state
  // to avoid stomping in-flight toggles. When idle it adopts server state so
  // remote updates from other clients (e.g. hiding a column) show up here.
  const [hasPendingEdit, setHasPendingEdit] = useState(false);

  const properties = useMemo(() => base?.properties ?? [], [base?.properties]);
  const viewConfig = activeView?.config;

  const columns = useMemo(
    () => buildColumns(properties),
    [properties],
  );

  const initialSorting = useMemo(
    () => buildSortingState(viewConfig),
    [viewConfig],
  );

  const derivedColumnSizing = useMemo(
    () => buildColumnSizing(viewConfig),
    [viewConfig],
  );

  const derivedColumnOrder = useMemo(
    () => buildColumnOrder(viewConfig, properties),
    [viewConfig, properties],
  );

  const derivedColumnVisibility = useMemo(
    () => buildColumnVisibility(viewConfig, properties),
    [viewConfig, properties],
  );

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(derivedColumnOrder);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(derivedColumnVisibility);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(derivedColumnSizing);

  // Re-seed from the server only on view switch. Within the same view local
  // state is the source of truth. Without this guard, any ws-driven
  // invalidateQueries would land a new derivedColumnVisibility reference and
  // overwrite a pending toggle before persistViewConfig flushes it.
  const lastSyncedViewIdRef = useRef<string | undefined>(activeView?.id);
  useEffect(() => {
    const currentViewId = activeView?.id;

    if (currentViewId !== lastSyncedViewIdRef.current) {
      lastSyncedViewIdRef.current = currentViewId;
      setColumnOrder(derivedColumnOrder);
      setColumnVisibility(derivedColumnVisibility);
      setColumnSizing(derivedColumnSizing);
      return;
    }

    // Same view: if a local edit is pending, reconcile only the id set so
    // new/deleted columns appear without stomping the user's toggle.
    // If no edit is pending, adopt server state so remote updates show up.
    const validIds = new Set<string>(["__row_number"]);
    for (const p of properties) validIds.add(p.id);

    if (hasPendingEdit) {
      setColumnOrder((prev) => {
        const prevSet = new Set(prev);
        const kept = prev.filter((id) => validIds.has(id));
        const appended = derivedColumnOrder.filter(
          (id) => !prevSet.has(id) && validIds.has(id),
        );
        if (appended.length === 0 && kept.length === prev.length) return prev;
        return [...kept, ...appended];
      });

      setColumnVisibility((prev) => {
        let changed = false;
        const next: VisibilityState = {};
        for (const [id, visible] of Object.entries(prev)) {
          if (validIds.has(id)) {
            next[id] = visible;
          } else {
            changed = true;
          }
        }
        for (const id of derivedColumnOrder) {
          if (!(id in next)) {
            next[id] = derivedColumnVisibility[id] ?? true;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setColumnSizing((prev) => {
        let changed = false;
        const next: ColumnSizingState = {};
        for (const [id, width] of Object.entries(prev)) {
          if (validIds.has(id)) {
            next[id] = width;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } else {
      setColumnOrder(derivedColumnOrder);
      setColumnVisibility(derivedColumnVisibility);
      setColumnSizing(derivedColumnSizing);
    }
  }, [
    activeView?.id,
    derivedColumnOrder,
    derivedColumnVisibility,
    derivedColumnSizing,
    properties,
    hasPendingEdit,
  ]);

  const isMobile = useMediaQuery("(max-width: 48em)", false, {
    getInitialValueInEffect: false,
  });
  const columnPinning = useMemo(
    () => buildColumnPinning(properties, !isMobile),
    [properties, isMobile],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnPinning,
      columnOrder,
      columnVisibility,
      columnSizing,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    initialState: {
      sorting: initialSorting,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enableSorting: true,
    enableHiding: true,
    getRowId: (row) => row.id,
  });

  const persistViewConfig = useCallback(() => {
    if (!activeView || !base) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    setHasPendingEdit(true);

    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      const config = buildLayoutConfigPatch(table);
      updateViewMutation.mutate(
        { viewId: activeView.id, pageId: base.id, config },
        {
          onSettled: () => {
            // Only clear if no new debounce was scheduled while in flight.
            if (persistTimerRef.current === null) {
              setHasPendingEdit(false);
            }
          },
        },
      );
    }, 300);
  }, [activeView, base, table, updateViewMutation]);

  return { table, persistViewConfig };
}
