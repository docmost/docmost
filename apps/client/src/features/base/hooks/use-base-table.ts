import { useMemo, useCallback, useRef, useState, useEffect } from "react";
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
} from "@/features/base/types/base.types";
import { useUpdateViewMutation } from "@/features/base/queries/base-view-query";

const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 600;
const ROW_NUMBER_COLUMN_WIDTH = 64;

export const SYSTEM_PROPERTY_TYPES = new Set(["createdAt", "lastEditedAt", "lastEditedBy"]);

export function isSystemPropertyType(type: string): boolean {
  return SYSTEM_PROPERTY_TYPES.has(type);
}

const columnHelper = createColumnHelper<IBaseRow>();

function getSystemAccessor(type: string): ((row: IBaseRow) => unknown) | null {
  switch (type) {
    case "createdAt":
      return (row) => row.createdAt;
    case "lastEditedAt":
      return (row) => row.updatedAt;
    case "lastEditedBy":
      return (row) => row.lastUpdatedById ?? row.creatorId;
    default:
      return null;
  }
}

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
    const sysAccessor = getSystemAccessor(property.type);
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
): ColumnPinningState {
  const primary = properties.find((p) => p.isPrimary);
  return {
    left: primary ? ["__row_number", primary.id] : ["__row_number"],
    right: [],
  };
}

// Serializes the live react-table state into a persisted ViewConfig.
// Sort/filter toolbar mutations and the debounced `persistViewConfig`
// both go through this so a direct mutation (e.g. adding a sort) can't
// clobber a pending hide/reorder/resize by reading stale `activeView.config`.
export function buildViewConfigFromTable(
  table: Table<IBaseRow>,
  base: ViewConfig | undefined,
  overrides: Partial<ViewConfig> = {},
): ViewConfig {
  // Guard against corrupted persisted configs — if `base` ever comes
  // back as something other than a plain object (e.g. a jsonb-stored
  // string `"{}"` from a buggy seed), spreading it would iterate its
  // characters into keys `0`, `1`, … and poison the config forever.
  const safeBase =
    base && typeof base === "object" && !Array.isArray(base) ? base : {};
  const state = table.getState();

  const sorts = state.sorting.map((s) => ({
    propertyId: s.id,
    direction: (s.desc ? "desc" : "asc") as "asc" | "desc",
  }));

  const propertyWidths: Record<string, number> = {};
  Object.entries(state.columnSizing).forEach(([id, width]) => {
    if (id !== "__row_number") propertyWidths[id] = width;
  });

  const propertyOrder = state.columnOrder.filter((id) => id !== "__row_number");

  const hiddenPropertyIds = Object.entries(state.columnVisibility)
    .filter(([id, visible]) => id !== "__row_number" && !visible)
    .map(([id]) => id);

  return {
    ...safeBase,
    sorts,
    propertyWidths,
    propertyOrder,
    hiddenPropertyIds,
    visiblePropertyIds: undefined,
    ...overrides,
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
  // While a local edit is pending (debounce scheduled OR mutation in
  // flight), the reconcile effect preserves local state so we don't
  // stomp the user's in-flight toggle. When no local edit is pending,
  // the effect adopts server state — that's what makes remote updates
  // (another client hiding a column) actually show up on this client.
  const [hasPendingEdit, setHasPendingEdit] = useState(false);

  // `base?.properties ?? []` minted a fresh `[]` every render while the
  // base query was loading, which invalidated every downstream memo and
  // tripped the setState-in-useEffect pairs below → "Maximum update
  // depth exceeded". Memoize so the identity is stable.
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

  const initialColumnSizing = useMemo(
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

  // Re-seed from server only when the user switches views. Within the same
  // view, local state is the source of truth — the debounced persist flushes
  // it. Without this guard, any ws-driven `invalidateQueries(["bases", baseId])`
  // or concurrent view mutation lands a new `derivedColumnVisibility`
  // reference and the effect would overwrite a pending hide/reorder toggle
  // before `persistViewConfig` has a chance to flush it.
  const lastSyncedViewIdRef = useRef<string | undefined>(activeView?.id);
  useEffect(() => {
    const currentViewId = activeView?.id;

    // View switch → full re-seed from the server's stored config.
    if (currentViewId !== lastSyncedViewIdRef.current) {
      lastSyncedViewIdRef.current = currentViewId;
      setColumnOrder(derivedColumnOrder);
      setColumnVisibility(derivedColumnVisibility);
      return;
    }

    // Same view. If a local edit is pending (user just toggled and
    // the debounce hasn't flushed yet, or the mutation is in flight),
    // preserve local state — only reconcile the id set so that newly
    // created columns show up and deleted columns drop out without
    // stomping the user's toggle. If nothing local is pending, adopt
    // the server's state — this is what lets remote updates from
    // other clients show up here.
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
    } else {
      setColumnOrder(derivedColumnOrder);
      setColumnVisibility(derivedColumnVisibility);
    }
  }, [
    activeView?.id,
    derivedColumnOrder,
    derivedColumnVisibility,
    properties,
    hasPendingEdit,
  ]);

  const columnPinning = useMemo(
    () => buildColumnPinning(properties),
    [properties],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnPinning,
      columnOrder,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    initialState: {
      sorting: initialSorting,
      columnSizing: initialColumnSizing,
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
      const config = buildViewConfigFromTable(table, activeView.config);
      updateViewMutation.mutate(
        { viewId: activeView.id, baseId: base.id, config },
        {
          onSettled: () => {
            // Don't clear if the user has already scheduled another
            // debounce while this one was in flight.
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
